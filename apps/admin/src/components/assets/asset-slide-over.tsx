"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, StateBadge } from "@tagit/ui";
import { ExternalLink, ImageIcon, Loader2, ShieldOff, X } from "lucide-react";
import { anchorVerdict, readProduct } from "@/lib/catalog/logic";
import type { VerificationBlock } from "@/lib/catalog/types";
import { WagmiGuard } from "@/components/wagmi-guard";
import { AnchorDot } from "./anchor-dot";
import { IntegrityCheck } from "./integrity-check";
import { OverridesEditor } from "./overrides-editor";

const VERIFY_URL = process.env.NEXT_PUBLIC_VERIFY_URL || "https://verify.tagit.network";

interface DetailDto {
  tokenId?: string;
  restricted?: boolean;
  name?: string;
  image?: string;
  stateCode?: number;
  lifecycleState?: string;
  owner?: string;
  tagHash?: string;
  description?: string;
  product?: unknown;
  price?: { display?: string | null; saleState?: string } | null;
  verification?: VerificationBlock;
  provenance?: Array<{ type: string; label: string; timestamp?: number }>;
  error?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-b border-border pb-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value ?? "—"}</span>
    </div>
  );
}

/**
 * Row slide-over (META-T36): per-token detail from the catalog proxy with the
 * REQ-S-12 tri-state anchor verdict, the on-chain-hash-vs-served integrity
 * check, the overrides editor and the public provenance link.
 */
export function AssetSlideOver({ tokenId, onClose }: { tokenId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<DetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/catalog-proxy/assets/${tokenId}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as DetailDto | null;
        if (cancelled) return;
        if (!body || (!res.ok && res.status !== 404)) {
          setLoadError(body?.error ?? `Failed to load asset (HTTP ${res.status})`);
        } else {
          setDetail(body);
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenId, reloadKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const verification = detail?.verification ?? null;
  const verdict = anchorVerdict(verification);
  const product = readProduct(detail?.product);
  const bound = Boolean(detail?.tagHash);
  const restricted = detail?.restricted === true;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Asset #${tokenId}`}>
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Panel */}
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col overflow-y-auto border-l border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              {detail?.name && !restricted ? detail.name : `Asset #${tokenId}`}
            </h2>
            <AnchorDot verdict={verdict} showLabel />
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          {loading && (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading asset…
            </div>
          )}

          {!loading && loadError && (
            <p className="text-sm text-destructive">Error: {loadError}</p>
          )}

          {!loading && !loadError && detail && (
            <>
              {restricted && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  <ShieldOff className="h-4 w-4 shrink-0" />
                  Owner-restricted item — the catalog serves only the protected stub.
                </div>
              )}

              {detail.image && !restricted ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.image}
                  alt={detail.name ?? `Asset #${tokenId}`}
                  className="max-h-56 w-full rounded-md border border-border object-contain"
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}

              <Section title="Item">
                <Field label="Token ID" value={<code className="font-mono">#{tokenId}</code>} />
                <Field
                  label="Lifecycle"
                  value={
                    typeof detail.stateCode === "number" ? (
                      <StateBadge state={detail.stateCode} />
                    ) : (
                      detail.lifecycleState ?? "—"
                    )
                  }
                />
                <Field
                  label="Tag"
                  value={
                    bound ? (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                        Bound
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unbound</Badge>
                    )
                  }
                />
                <Field label="Owner" value={detail.owner ?? "—"} />
                <Field
                  label="Price"
                  value={
                    detail.price?.display ??
                    (detail.price?.saleState === "sold" ? "Sold" : "Not listed")
                  }
                />
              </Section>

              {product && Object.keys(product).length > 0 && (
                <Section title="Product">
                  {product.brand && <Field label="Brand" value={product.brand} />}
                  {product.model && <Field label="Model" value={product.model} />}
                  {product.sku && <Field label="SKU" value={product.sku} />}
                  {product.category && <Field label="Category" value={product.category} />}
                  {product.origin && <Field label="Origin" value={product.origin} />}
                </Section>
              )}

              {!restricted && (
                <Section title="Anchor verification (REQ-S-12)">
                  <Field label="Verdict" value={<AnchorDot verdict={verdict} showLabel />} />
                  <Field label="Anchored version" value={verification?.anchoredVersion ?? "—"} />
                  <Field label="Latest version" value={verification?.latestVersion ?? "—"} />
                  <Field label="Anchor status" value={verification?.anchorStatus ?? "—"} />
                  {verdict === "drift" && (
                    <p className="text-xs text-red-500">
                      The latest metadata version is not the anchored one — the public trust rule
                      keeps serving the last-anchored doc until the new anchor confirms.
                    </p>
                  )}
                  {verdict === "pending" && (
                    <p className="text-xs text-yellow-500">
                      Anchor pending — the canonical doc is published but not yet confirmed
                      on-chain.
                    </p>
                  )}
                </Section>
              )}

              {!restricted && (
                <Section title="On-chain integrity">
                  <WagmiGuard
                    fallback={
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting…
                      </div>
                    }
                  >
                    <IntegrityCheck
                      tokenId={tokenId}
                      servedHash={verification?.metadataHash ?? null}
                    />
                  </WagmiGuard>
                </Section>
              )}

              {!restricted && (
                <Section title="Overrides">
                  <OverridesEditor
                    tokenId={tokenId}
                    bound={bound}
                    onPublished={() => setReloadKey((k) => k + 1)}
                  />
                </Section>
              )}

              <section className="flex flex-wrap items-center gap-3 pt-1">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`${VERIFY_URL}/asset/${tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Public provenance
                  </a>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/assets/${tokenId}`}>Lifecycle console</Link>
                </Button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
