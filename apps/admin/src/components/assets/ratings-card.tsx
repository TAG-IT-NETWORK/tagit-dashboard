"use client";

import { useCallback, useEffect, useState } from "react";
import { EyeOff, Eye, Loader2, Star } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tagit/ui";
import type { CatalogRole } from "@/lib/catalog/template-logic";
import { canPublishCatalog } from "@/lib/catalog/template-logic";

interface Summary {
  average: number | null;
  count: number;
}
interface Review {
  id: number;
  stars: number;
  review: string | null;
  rater: string;
  createdAt: string;
  hidden?: boolean;
}

function Stars({ value }: { value: number | null }) {
  const v = Math.round(value ?? 0);
  return (
    <span className="tracking-tight">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`inline h-3.5 w-3.5 ${i <= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
      ))}
    </span>
  );
}

/** Verified-owner ratings for one token: summaries + reviews, admin can hide/unhide. */
export function RatingsCard({ tokenId, role }: { tokenId: string; role: CatalogRole | null }) {
  const [item, setItem] = useState<Summary | null>(null);
  const [product, setProduct] = useState<(Summary & { templateId: string }) | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const canModerate = canPublishCatalog(role);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/catalog-proxy/ratings?tokenId=${tokenId}`, { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; item?: Summary; product?: Summary & { templateId: string }; reviews?: Review[] } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? `ratings unavailable (HTTP ${res.status})`);
        return;
      }
      setItem(body.item ?? null);
      setProduct(body.product ?? null);
      setReviews(body.reviews ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [tokenId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (r: Review) => {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/catalog-proxy/ratings/${r.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ hidden: !r.hidden }) });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `moderation failed (HTTP ${res.status})`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-amber-400" /> Owner ratings
            </CardTitle>
            <CardDescription>Signed by the wallet that owns the token; one per owner. Hidden rows stay in the audit trail.</CardDescription>
          </div>
          {item && (
            <div className="text-right text-sm">
              <div className="flex items-center justify-end gap-2">
                <Stars value={item.average} />
                <span className="font-semibold">{item.average?.toFixed(1) ?? "—"}</span>
                <span className="text-muted-foreground">({item.count})</span>
              </div>
              {product && <p className="text-xs text-muted-foreground">product line {product.average?.toFixed(1) ?? "—"} · {product.count} ratings</p>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!error && reviews.length === 0 && <p className="text-sm text-muted-foreground">No ratings yet.</p>}
        <ul className="divide-y divide-border">
          {reviews.map((r) => (
            <li key={r.id} className={`flex items-start justify-between gap-3 py-2 ${r.hidden ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Stars value={r.stars} />
                  <span className="font-mono">{r.rater}</span>
                  <span>{r.createdAt.slice(0, 10)}</span>
                  {r.hidden && <Badge variant="destructive" className="text-[10px]">hidden</Badge>}
                </div>
                {r.review && <p className="mt-1 text-sm">{r.review}</p>}
              </div>
              {canModerate && (
                <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" disabled={busy === r.id} onClick={() => void toggle(r)} title={r.hidden ? "Show again" : "Hide from the public pages"}>
                  {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : r.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
