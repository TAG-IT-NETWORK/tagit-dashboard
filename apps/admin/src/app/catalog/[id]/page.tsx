import Link from "next/link";

import { TemplateEditor } from "@/components/catalog/template-editor";
import { getActorRole } from "@/lib/actor-role";
import { TEMPLATE_ID_RE } from "@/lib/catalog/template-logic";

/**
 * /catalog/:id — template editor (META-T33). Thin server wrapper: id-format
 * gate + role resolution; the editor itself is client-side and talks to the
 * catalog proxies (admin key stays server-side).
 */

export const dynamic = "force-dynamic";

export default async function CatalogTemplatePage({ params }: { params: { id: string } }) {
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
  return <TemplateEditor id={params.id} role={role} />;
}
