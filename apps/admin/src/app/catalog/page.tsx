import Link from "next/link";
import { AlertTriangle, BookOpen, ImageIcon } from "lucide-react";

import { NewTemplateButton } from "@/components/catalog/new-template-button";
import { StatusChip } from "@/components/catalog/status-chip";
import { getActorRole } from "@/lib/actor-role";
import {
  formatMsrpDisplay,
  formatUsdc6Display,
  templateThumbUrl,
} from "@/lib/catalog/template-logic";
import type { TemplateDto } from "@/lib/catalog/template-types";
import { fetchTemplatesList } from "@/lib/server/templates-upstream";

/**
 * /catalog — product-template list (META-T33). Server-rendered straight from
 * GET /api/v1/admin/templates (admin key stays server-side); the archived
 * toggle is a URL search param so the filter survives reload/share.
 *
 * Item count column: tagit-services main exposes no per-template item count
 * (no template→items enumeration endpoint) — rendered as "—" with the reason
 * in the tooltip rather than a fabricated number.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: { archived?: string };
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const showArchived = searchParams?.archived === "1";
  const [{ templates, error }, role] = await Promise.all([fetchTemplatesList(), getActorRole()]);

  const visible = (templates ?? []).filter((t) => showArchived || t.status !== "archived");
  const archivedCount = (templates ?? []).filter((t) => t.status === "archived").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Catalog
          </h1>
          <p className="text-muted-foreground text-sm">
            Product templates on tagit-services — drafts, published snapshots and propagation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={showArchived ? "/catalog" : "/catalog?archived=1"}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </Link>
          <NewTemplateButton role={role} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!error && visible.length === 0 && (
        <div className="rounded-md border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          {showArchived
            ? "No templates yet. Create the first draft to get started."
            : "No active templates. Create a draft, or show archived ones."}
        </div>
      )}

      {visible.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium w-14"></th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium" title="tagit-services exposes no per-template item enumeration/count endpoint yet">
                  Items
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <TemplateRow key={t.id} template={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TemplateRow({ template: t }: { template: TemplateDto }) {
  const thumb = templateThumbUrl(t.attributes);
  const price = formatUsdc6Display(t.priceUsdc6);
  const msrp = formatMsrpDisplay(t.msrpAmount, t.msrpCurrency);
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2">
        <Link href={`/catalog/${t.id}`} className="block">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote media host, size-capped thumb
            <img
              src={thumb}
              alt=""
              className="h-9 w-9 rounded-md object-cover border"
              loading="lazy"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
            </span>
          )}
        </Link>
      </td>
      <td className="px-4 py-2">
        <Link href={`/catalog/${t.id}`} className="font-medium hover:underline">
          {t.name}
        </Link>
        <div className="text-xs text-muted-foreground font-mono">{t.slug}</div>
      </td>
      <td className="px-4 py-2 font-mono text-xs">{t.sku ?? "—"}</td>
      <td className="px-4 py-2">
        <StatusChip status={t.status} />
      </td>
      <td className="px-4 py-2">
        {price ?? <span className="text-muted-foreground">—</span>}
        {msrp && <div className="text-xs text-muted-foreground">MSRP {msrp}</div>}
      </td>
      <td className="px-4 py-2 font-mono text-xs">{t.version > 0 ? `v${t.version}` : "draft"}</td>
      <td
        className="px-4 py-2 text-muted-foreground"
        title="tagit-services exposes no per-template item enumeration/count endpoint yet — see the editor's Items tab"
      >
        —
      </td>
    </tr>
  );
}
