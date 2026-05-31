"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { Button, Card, CardContent, Input } from "@tagit/ui";
import { useMint } from "@tagit/contracts";
import { WagmiGuard } from "@/components/wagmi-guard";
import { LifecycleConsole } from "@/components/lifecycle-console";

function LoadingState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Loading console…</p>
    </div>
  );
}

function ConsoleInner() {
  const [input, setInput] = useState("27");
  const [tokenId, setTokenId] = useState<bigint | null>(27n);
  const { address } = useAccount();
  const mint = useMint();

  function load() {
    const n = Number(input);
    if (Number.isInteger(n) && n > 0) setTokenId(BigInt(n));
  }

  // When a freshly-minted token confirms, jump straight into its console.
  useEffect(() => {
    if (mint.tokenId) {
      setTokenId(mint.tokenId);
      setInput(mint.tokenId.toString());
    }
  }, [mint.tokenId]);

  const minting = mint.isPending || mint.isConfirming;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div>
        <h1 className="font-syne text-2xl font-bold">Digital Twin Console</h1>
        <p className="text-sm text-muted-foreground">
          State-driven asset control — actions follow the live on-chain lifecycle, not a fixed
          script. Mint a new twin or load an existing one to inspect and operate on it.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 py-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Token ID</label>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="27"
              inputMode="numeric"
            />
          </div>
          <Button variant="outline" onClick={load}>
            Load
          </Button>
          <Button
            disabled={!address || minting}
            onClick={() => address && mint.mint(address, `ipfs://tagit/console/${address}`)}
          >
            {minting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Minting…
              </>
            ) : (
              <>
                <Plus className="mr-1.5 h-4 w-4" /> Mint new
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {tokenId !== null && <LifecycleConsole key={tokenId.toString()} tokenId={tokenId} />}
    </div>
  );
}

export default function ConsolePage() {
  return (
    <WagmiGuard fallback={<LoadingState />}>
      <ConsoleInner />
    </WagmiGuard>
  );
}
