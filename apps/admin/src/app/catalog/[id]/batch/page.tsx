import Link from "next/link";

import { BatchWizard } from "@/components/batch/batch-wizard";
import { getActorRole } from "@/lib/actor-role";
import { BATCH_ID_RE } from "@/lib/catalog/batch-logic";
import { TEMPLATE_ID_RE } from "@/lib/catalog/template-logic";

/**
 * /catalog/:id/batch — batch mint wizard (META-T34). Thin server wrapper
 * (same shape as /catalog/:id): id-format gate + role resolution; the wizard
 * itself is client-side and talks to the batch proxies (admin + relayer keys
 * stay server-side).
 *
 * RESUMABLE: ?batch=bat_… re-enters the wizard at whatever step the batch's
 * server-side state dictates — the id is validated here so the client never
 * sees a malformed one.
 */

export const dynamic = "force-dynamic";

export default async function CatalogBatchPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { batch?: string };
}) {
  if (!TEMPLATE_ID_RE.test(params.id)) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Not a template id (tpl_…).
        </div>
        <Link href="/catalog" className="text-sm underline underline-offset-4">
          Back to catalog
        </Link>
      </div>
    );
  }
  const role = await getActorRole();
  const initialBatchId =
    typeof searchParams.batch === "string" && BATCH_ID_RE.test(searchParams.batch)
      ? searchParams.batch
      : null;
  return <BatchWizard templateId={params.id} role={role} initialBatchId={initialBatchId} />;
}
