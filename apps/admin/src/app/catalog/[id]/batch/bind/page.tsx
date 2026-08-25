import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BindingStation } from "@/components/binding/binding-station";
import { ExceptionLog } from "@/components/binding/exception-log";
import { getActorRole } from "@/lib/actor-role";
import { BATCH_ID_RE } from "@/lib/binding/station";
import { TEMPLATE_ID_RE } from "@/lib/catalog/template-logic";

/**
 * /catalog/:id/batch/bind — batch binding station (META-T35). Thin server
 * wrapper: batch-id resolution + role; the station itself is client-side and
 * talks to the catalog proxies (admin/relayer keys stay server-side).
 *
 * The batch rides in as either the [id] segment directly (bat_…) or — when
 * [id] is the template (tpl_…) — as ?batch=bat_….
 */

export const dynamic = "force-dynamic";

export default async function BatchBindPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { batch?: string };
}) {
  const fromQuery = typeof searchParams.batch === "string" ? searchParams.batch : "";
  const batchId = BATCH_ID_RE.test(params.id)
    ? params.id
    : BATCH_ID_RE.test(fromQuery)
      ? fromQuery
      : null;

  if (batchId === null) {
    const isTemplate = TEMPLATE_ID_RE.test(params.id);
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {isTemplate
            ? "No batch selected — open this page with ?batch=bat_… for a batch of this template."
            : "Not a batch id (bat_…)."}
        </div>
        <Link
          href={isTemplate ? `/catalog/${params.id}` : "/catalog"}
          className="text-sm underline underline-offset-4"
        >
          Back to catalog
        </Link>
      </div>
    );
  }

  const role = await getActorRole();
  // Breadcrumb back up the T34→T35 chain: editor → batch wizard → station.
  // With a tpl_ [id] the wizard link resumes the same batch (?batch=…);
  // reached bare (bat_ as [id]) the best anchor we have is the catalog root.
  const isTemplate = TEMPLATE_ID_RE.test(params.id);
  return (
    <div className="space-y-4">
      <Link
        href={isTemplate ? `/catalog/${params.id}/batch?batch=${batchId}` : "/catalog"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isTemplate ? "Batch mint wizard" : "Catalog"}
      </Link>
      <BindingStation
        batchId={batchId}
        role={role}
        exceptionsTab={<ExceptionLog batchId={batchId} />}
      />
    </div>
  );
}
