import { AgentCatalog } from "@/components/agents/agent-catalog";
import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";

export const dynamic = "force-dynamic";

/** /agents/catalog — every agent of the mesh: running, in beta, planned, proposed. */
export default async function AgentCatalogPage() {
  const role = await getActorRole();
  return <AgentCatalog canRun={canMutateCatalog(role)} />;
}
