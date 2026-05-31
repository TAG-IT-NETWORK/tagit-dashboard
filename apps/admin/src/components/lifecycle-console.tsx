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
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl">Digital Twin #{tokenId.toString()}</CardTitle>
            <div className="mt-2 flex items-center gap-2">
              <StateBadge state={asset.state} />
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>
              Owner: <AddressBadge address={asset.owner} />
            </div>
            <div className="mt-1 font-mono">tag: {short(tagHash as string | undefined)}</div>
          </div>
        </CardHeader>
      </Card>

      {/* Live FSM graph */}
      <LifecycleFsmGraph state={asset.state} />

      {/* State-driven actions */}
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
                executes. Approve with this wallet, switch accounts, approve again, then Resolve.
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
