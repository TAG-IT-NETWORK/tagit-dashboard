"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useAllAssets, useMint } from "@tagit/contracts";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  StateBadge,
  AddressBadge,
  cn,
} from "@tagit/ui";
import { Package, Plus } from "lucide-react";

function MintDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { address } = useAccount();
  const { mint, isPending, isConfirming, isSuccess, error, tokenId } = useMint();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setSku("");
    }
  }, [open]);

  const submit = () => {
    if (!address || !name.trim()) return;
    const metadata = JSON.stringify({ name: name.trim(), sku: sku.trim() || undefined });
    const metadataURI = `data:application/json,${encodeURIComponent(metadata)}`;
    mint(address, metadataURI);
  };

  const busy = isPending || isConfirming;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>
            Mints an on-chain digital twin for a physical product. You can bind an NFC tag after
            minting.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-6 text-center space-y-2">
            <div className="text-lg font-medium">Product minted</div>
            {tokenId !== null && (
              <p className="text-sm text-muted-foreground">
                Token ID <span className="font-mono">#{tokenId.toString()}</span>
              </p>
            )}
            <Button asChild className="mt-2">
              <Link href={tokenId !== null ? `/products/${tokenId.toString()}` : "/products"}>
                View product
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="product-name">Product name</Label>
                <Input
                  id="product-name"
                  placeholder="Leather Jacket — Model X"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-sku">SKU (optional)</Label>
                <Input
                  id="product-sku"
                  placeholder="LJX-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={busy}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive break-all">{error.message.split("\n")[0]}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy || !name.trim() || !address}>
                {isPending ? "Confirm in wallet..." : isConfirming ? "Minting..." : "Mint product"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ProductsPage() {
  const { address } = useAccount();
  const [page, setPage] = useState(0);
  const [mineOnly, setMineOnly] = useState(false);
  const [mintOpen, setMintOpen] = useState(false);
  const { assets, totalSupply, totalPages, hasNextPage, hasPrevPage, isLoading, refetch } =
    useAllAssets({ page, pageSize: 25, refetchInterval: 15_000 });

  useEffect(() => {
    if (!mintOpen) refetch();
  }, [mintOpen, refetch]);

  const visible = useMemo(
    () =>
      mineOnly && address
        ? assets.filter((a) => a.owner.toLowerCase() === address.toLowerCase())
        : assets,
    [assets, mineOnly, address],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalSupply} products registered on Base Sepolia.
          </p>
        </div>
        <Button onClick={() => setMintOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add product
        </Button>
      </div>

      <div role="group" aria-label="Filter products" className="flex gap-2">
        <button
          type="button"
          aria-pressed={!mineOnly}
          onClick={() => setMineOnly(false)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium",
            !mineOnly
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent",
          )}
        >
          All
        </button>
        <button
          type="button"
          aria-pressed={mineOnly}
          onClick={() => setMineOnly(true)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium",
            mineOnly
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent",
          )}
        >
          Mine
        </button>
      </div>

      {mineOnly && totalPages > 1 && (
        <p className="text-xs text-muted-foreground">
          Filtering the current page only — your products on other pages aren&apos;t shown.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Package className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {mineOnly ? "You don't own any products on this page." : "No products found."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Registered products</caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="font-medium px-6 py-3">Token</th>
                    <th className="font-medium px-6 py-3">Owner</th>
                    <th className="font-medium px-6 py-3">State</th>
                    <th className="font-medium px-6 py-3 text-right">Minted</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((asset) => (
                    <tr
                      key={asset.tokenId.toString()}
                      className="border-b last:border-0 hover:bg-secondary/40"
                    >
                      <td className="px-6 py-3">
                        <Link
                          href={`/products/${asset.tokenId.toString()}`}
                          className="font-mono font-medium hover:underline"
                        >
                          #{asset.tokenId.toString()}
                        </Link>
                      </td>
                      <td className="px-6 py-3">
                        <AddressBadge address={asset.owner} />
                      </td>
                      <td className="px-6 py-3">
                        <StateBadge state={asset.state} />
                      </td>
                      <td className="px-6 py-3 text-right text-muted-foreground">
                        {asset.timestamp > 0n
                          ? new Date(Number(asset.timestamp) * 1000).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrevPage}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <MintDialog open={mintOpen} onOpenChange={setMintOpen} />
    </div>
  );
}
