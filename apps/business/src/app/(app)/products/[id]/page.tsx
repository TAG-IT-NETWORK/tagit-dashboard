"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keccak256, toBytes } from "viem";
import { useAccount, useChainId } from "wagmi";
import {
  useAsset,
  useTagByToken,
  useBindTag,
  useActivate,
  useClaim,
  useFlag,
  AssetState,
  getExplorerAddressUrl,
  getContractsForChain,
} from "@tagit/contracts";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  StateBadge,
  AddressBadge,
} from "@tagit/ui";
import { ArrowLeft, ExternalLink } from "lucide-react";

const ZERO_TAG = `0x${"0".repeat(64)}` as const;

function BindTagPanel({ tokenId, onDone }: { tokenId: bigint; onDone: () => void }) {
  const { bindTag, isPending, isConfirming, isSuccess, error } = useBindTag();
  const [tagUid, setTagUid] = useState("");

  useEffect(() => {
    if (isSuccess) onDone();
  }, [isSuccess, onDone]);

  const busy = isPending || isConfirming;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="tag-uid">NFC tag UID</Label>
        <Input
          id="tag-uid"
          placeholder="04:A3:2F:..."
          value={tagUid}
          onChange={(e) => setTagUid(e.target.value)}
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">
          The UID is hashed on-device; only the hash goes on-chain.
        </p>
      </div>
      <p className="rounded-lg border border-dashed bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
        Binding requires an authorized oracle signature. On this testnet build the attestation is
        signed by your connected wallet, so it only succeeds if that wallet is the contract&apos;s
        trusted oracle — production routes this through the oracle service.
      </p>
      {error && <p className="text-sm text-destructive">{error.message.split("\n")[0]}</p>}
      <Button
        onClick={() => bindTag(tokenId, keccak256(toBytes(tagUid.trim())))}
        disabled={busy || !tagUid.trim()}
      >
        {isPending ? "Confirm in wallet..." : isConfirming ? "Binding..." : "Bind tag"}
      </Button>
    </div>
  );
}

function ClaimPanel({ tokenId, onDone }: { tokenId: bigint; onDone: () => void }) {
  const { claim, isPending, isConfirming, isSuccess, error } = useClaim();
  const [newOwner, setNewOwner] = useState("");

  useEffect(() => {
    if (isSuccess) onDone();
  }, [isSuccess, onDone]);

  const busy = isPending || isConfirming;
  const valid = /^0x[a-fA-F0-9]{40}$/.test(newOwner.trim());

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="new-owner">Transfer to (buyer wallet)</Label>
        <Input
          id="new-owner"
          placeholder="0x..."
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
          disabled={busy}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error.message.split("\n")[0]}</p>}
      <Button
        onClick={() => claim(tokenId, newOwner.trim() as `0x${string}`)}
        disabled={busy || !valid}
      >
        {isPending ? "Confirm in wallet..." : isConfirming ? "Claiming..." : "Claim to buyer"}
      </Button>
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const tokenId = useMemo(() => {
    try {
      return BigInt(params.id);
    } catch {
      return 0n;
    }
  }, [params.id]);

  const { address } = useAccount();
  const chainId = useChainId();
  const { asset, isLoading, refetch } = useAsset(tokenId);
  const { data: tagHash } = useTagByToken(tokenId);
  const activateHook = useActivate();
  const flagHook = useFlag();

  useEffect(() => {
    if (activateHook.isSuccess || flagHook.isSuccess) refetch();
  }, [activateHook.isSuccess, flagHook.isSuccess, refetch]);

  const isOwner = !!address && !!asset && asset.owner.toLowerCase() === address.toLowerCase();
  const coreAddress = getContractsForChain(chainId).TAGITCore;
  const boundTag = tagHash && tagHash !== ZERO_TAG ? (tagHash as string) : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-secondary animate-pulse" />
        <div className="h-40 rounded-xl bg-secondary animate-pulse" />
      </div>
    );
  }

  if (!asset || asset.state === AssetState.NONE) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Product #{params.id} not found on Base Sepolia.</p>
        <Button asChild variant="outline">
          <Link href="/products">Back to products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Products
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight font-mono">#{tokenId.toString()}</h1>
          <StateBadge state={asset.state} />
        </div>
        <a
          href={`${getExplorerAddressUrl(chainId, coreAddress)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          View on BaseScan
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Owner</span>
              <AddressBadge address={asset.owner} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Last updated</span>
              <span>
                {asset.timestamp > 0n
                  ? new Date(Number(asset.timestamp) * 1000).toLocaleString()
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">NFC tag</span>
              {boundTag ? (
                <span className="font-mono text-xs">{`${boundTag.slice(0, 10)}...${boundTag.slice(-6)}`}</span>
              ) : (
                <span className="text-muted-foreground">Not bound</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Network</span>
              <span>Base Sepolia</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifecycle actions</CardTitle>
            <CardDescription>
              {isOwner
                ? "Move this product through its lifecycle."
                : "Only the current owner can act on this product."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isOwner ? (
              <p className="text-sm text-muted-foreground py-4">No actions available.</p>
            ) : asset.state === AssetState.MINTED ? (
              <BindTagPanel tokenId={tokenId} onDone={refetch} />
            ) : asset.state === AssetState.BOUND ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tag bound. Activate the product to make it sellable and verifiable.
                </p>
                {activateHook.error && (
                  <p className="text-sm text-destructive">
                    {activateHook.error.message.split("\n")[0]}
                  </p>
                )}
                <Button
                  onClick={() => activateHook.activate(tokenId)}
                  disabled={activateHook.isPending || activateHook.isConfirming}
                >
                  {activateHook.isPending
                    ? "Confirm in wallet..."
                    : activateHook.isConfirming
                      ? "Activating..."
                      : "Activate"}
                </Button>
              </div>
            ) : asset.state === AssetState.ACTIVATED ? (
              <ClaimPanel tokenId={tokenId} onDone={refetch} />
            ) : asset.state === AssetState.CLAIMED ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Product is claimed. If it's lost or stolen, flag it to start recovery.
                </p>
                {flagHook.error && (
                  <p className="text-sm text-destructive">
                    {flagHook.error.message.split("\n")[0]}
                  </p>
                )}
                <Button
                  variant="destructive"
                  onClick={() => flagHook.flag(tokenId)}
                  disabled={flagHook.isPending || flagHook.isConfirming}
                >
                  {flagHook.isPending
                    ? "Confirm in wallet..."
                    : flagHook.isConfirming
                      ? "Flagging..."
                      : "Flag as lost / stolen"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                No actions available in this state.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
