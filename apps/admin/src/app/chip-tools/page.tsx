import { ChipTools } from "@/components/chip-tools/chip-tools";
import { getActorRole } from "@/lib/actor-role";
import { canMutateCatalog } from "@/lib/catalog/template-logic";

export const dynamic = "force-dynamic";

/**
 * /chip-tools — low-level NTAG 424 DNA workbench on the desktop reader:
 * decode whatever is on a chip, program SDM (any https base URL), write a
 * plain URL (SDM off), or reset the SDM keys. Writes are operator-gated
 * client-side like the station; the bridge itself stays local.
 */
export default async function ChipToolsPage() {
  const role = await getActorRole();
  return <ChipTools writable={canMutateCatalog(role)} />;
}
