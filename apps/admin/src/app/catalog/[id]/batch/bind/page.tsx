import Link from "next/link";

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
  return (
    <BindingStation
      batchId={batchId}
      role={role}
      exceptionsTab={<ExceptionLog batchId={batchId} />}
    />
  );
}
