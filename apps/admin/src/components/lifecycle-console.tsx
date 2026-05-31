"use client";

/**
 * Digital Twin Console — the state-driven, branched-FSM replacement for the old
 * linear lifecycle stepper. Composes the asset header, live FSM graph, the
 * capability-aware action panel, and the on-chain audit trail. Actions are
 * driven by the asset's real state (so Flag works on a Bound asset, Resell on a
 * Claimed one), and Program SDM is reachable any time via the Bind modal.
 */
import { useEffect, useMemo, useState } from "react";
import { useChainId } from "wagmi";
import {
  AddressBadge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  StateBadge,
} from "@tagit/ui";
import {
  AssetState,
  useActivate,
  useApproveResolve,
  useAsset,
  useClaim,
  useFlag,
  useRecycle,
  useResolve,
  useTagByToken,
  useTransferAsset,
} from "@tagit/contracts";
import { isAddress } from "viem";
import { LifecycleActionPanel } from "./lifecycle-action-panel";
import { LifecycleFsmGraph } from "./lifecycle-fsm-graph";
import { LifecycleAuditTrail } from "./lifecycle-audit-trail";
import { BindTagModal } from "./bind-tag-modal";
import type { LifecycleActionKey } from "@/lib/lifecycle-fsm";

const EXPLORER: Record<number, string> = {
  84532: "https://sepolia.basescan.org",
  11155420: "https://sepolia-optimism.etherscan.io",
  421614: "https://sepolia.arbiscan.io",
};

const CHAIN_NAME: Record<number, string> = {
  84532: "Base Sepolia",
  11155420: "OP Sepolia",
  421614: "Arbitrum Sepolia",
};

/** One-line, operator-facing description per lifecycle state. */
const STATE_DESC: Record<number, string> = {
  0: "This twin does not exist.",
  1: "NFT minted — no physical tag bound yet.",
  2: "NFC tag cryptographically bound to this twin.",
  3: "QA passed — released to market.",
  4: "Owned by an end consumer.",
  5: "Flagged: recall, lost, or stolen — in recovery.",
  6: "Retired — end of life (terminal).",
};

function short(a?: string) {
  return a ? `${a.slice(0, 10)}…${a.slice(-6)}` : "—";
}

export function LifecycleConsole({ tokenId }: { tokenId: bigint }) {
  const chainId = useChainId();
  const explorerBase = EXPLORER[chainId];
  const { asset, refetch } = useAsset(tokenId);
  const { data: tagHash } = useTagByToken(tokenId);

  // Action hooks
  const activate = useActivate();
  const claim = useClaim();
  const flag = useFlag();
  const recycle = useRecycle();
  const transfer = useTransferAsset();
  const approveResolve = useApproveResolve();
  const resolve = useResolve();

  // Inline form state for actions that need an address input.
  const [form, setForm] = useState<{ action: LifecycleActionKey; value: string } | null>(null);
  const [bindOpen, setBindOpen] = useState(false);

  // Refetch the asset whenever any action confirms.
  const anySuccess =
    activate.isSuccess ||
    claim.isSuccess ||
    flag.isSuccess ||
    recycle.isSuccess ||
    transfer.isSuccess ||
    resolve.isSuccess;
  useEffect(() => {
    if (anySuccess) {
      refetch();
      setForm(null);
    }
  }, [anySuccess, refetch]);

  const pendingAction: LifecycleActionKey | null = useMemo(() => {
    if (activate.isPending || activate.isConfirming) return "activate";
    if (claim.isPending || claim.isConfirming) return "claim";
    if (flag.isPending || flag.isConfirming) return "flag";
    if (recycle.isPending || recycle.isConfirming) return "recycle";
    if (transfer.isPending || transfer.isConfirming) return "transfer";
    if (resolve.isPending || resolve.isConfirming) return "resolve";
    return null;
  }, [
    activate.isPending,
    activate.isConfirming,
    claim.isPending,
    claim.isConfirming,
    flag.isPending,
    flag.isConfirming,
    recycle.isPending,
    recycle.isConfirming,
    transfer.isPending,
    transfer.isConfirming,
    resolve.isPending,
    resolve.isConfirming,
  ]);

  function handleAction(key: LifecycleActionKey) {
    switch (key) {
      case "bind":
        setBindOpen(true);
        return;
      case "activate":
        activate.activate(tokenId);
        return;
      case "flag":
        flag.flag(tokenId);
        return;
      case "recycle":
        recycle.recycle(tokenId);
        return;
      // address-input actions reveal an inline form
      case "claim":
      case "transfer":
      case "resolve":
        setForm({ action: key, value: "" });
        return;
    }
  }

  function submitForm() {
    if (!form) return;
    const to = form.value.trim();
    if (!isAddress(to)) return;
    if (form.action === "claim") claim.claim(tokenId, to);
    else if (form.action === "transfer") transfer.transferAsset(tokenId, to);
    else if (form.action === "resolve") resolve.resolve(tokenId, to);
  }

  if (!asset) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Loading asset #{tokenId.toString()}…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="animate-fadeUp space-y-5">
      {/* Header — full width */}
      <Card>
        <CardContent className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-syne text-2xl font-bold leading-none">
                  Digital Twin #{tokenId.toString()}
                </h2>
                <StateBadge state={asset.state} className="px-3 py-1 text-sm" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{STATE_DESC[asset.state]}</p>
            </div>
            <dl className="grid shrink-0 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Owner</dt>
              <dd>
                <AddressBadge address={asset.owner} />
              </dd>
              <dt className="text-muted-foreground">Tag</dt>
              <dd className="font-mono text-xs">{short(tagHash as string | undefined)}</dd>
              <dt className="text-muted-foreground">Chain</dt>
              <dd className="text-xs">{CHAIN_NAME[chainId] ?? `Chain ${chainId}`}</dd>
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* 2-column: lifecycle (left) · actions + audit (right) */}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Left — live lifecycle position */}
        <LifecycleFsmGraph state={asset.state} />

        {/* Right — what you can do + what happened */}
        <div className="space-y-5">
          <LifecycleActionPanel
            state={asset.state}
            owner={asset.owner}
            onAction={handleAction}
            pendingAction={pendingAction}
          />

          {/* Inline address form for claim / transfer / resolve */}
          {form && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {form.action === "claim"
                    ? "Claim — assign consumer owner"
                    : form.action === "transfer"
                    ? "Resell — new owner address"
                    : "Resolve — rightful owner (needs 2-of-3 quorum)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="0x… recipient address"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="font-mono"
                />
                {form.action === "resolve" && (
                  <p className="text-xs text-muted-foreground">
                    Two different RESOLVER wallets must approve the same recipient before Resolve
                    executes. Approve with this wallet, switch accounts, approve again, then
                    Resolve.
                  </p>
                )}
                <div className="flex gap-2">
                  {form.action === "resolve" && (
                    <Button
                      variant="outline"
                      disabled={!isAddress(form.value.trim()) || approveResolve.isPending}
                      onClick={() =>
                        approveResolve.approveResolve(tokenId, form.value.trim() as `0x${string}`)
                      }
                    >
                      Approve (1 of 2)
                    </Button>
                  )}
                  <Button
                    disabled={!isAddress(form.value.trim()) || !!pendingAction}
                    onClick={submitForm}
                  >
                    {form.action === "transfer"
                      ? "Resell"
                      : form.action === "claim"
                      ? "Claim"
                      : "Resolve"}
                  </Button>
                  <Button variant="ghost" onClick={() => setForm(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit trail */}
          <LifecycleAuditTrail tokenId={tokenId} explorerBase={explorerBase} />
        </div>
      </div>

      {/* NFC bind + Program SDM (decoupled — available any time) */}
      <BindTagModal
        open={bindOpen}
        onOpenChange={setBindOpen}
        tokenId={tokenId}
        onSuccess={() => {
          setBindOpen(false);
          refetch();
        }}
      />

      {asset.state === AssetState.MINTED && (
        <p className="text-center text-xs text-muted-foreground">
          Tip: bind an NFC tag (and Program SDM) via the Bind action above — reachable any time.
        </p>
      )}
    </div>
  );
}
