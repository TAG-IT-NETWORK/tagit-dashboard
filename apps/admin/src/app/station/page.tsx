import { StationLanding } from "@/components/binding/station-landing";
import { getActorRole } from "@/lib/actor-role";
import { parseTokenIdInput } from "@/lib/binding/single";
import { canMutateCatalog } from "@/lib/catalog/template-logic";

export const dynamic = "force-dynamic";

/**
 * /station — the front door to the binding station. Lists every batch with
 * its chip progress so an operator opens the right station in one click
 * instead of navigating Catalog → template → Batch → Bind.
 *
 * ?token=59 pre-fills the "Bind a single asset" card (the asset page's Bind
 * button links here) for tokens minted outside any batch.
 */
export default async function StationPage(props: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await props.searchParams;
  const role = await getActorRole();
  return (
    <StationLanding
      writable={canMutateCatalog(role)}
      initialTokenId={parseTokenIdInput(searchParams.token)}
    />
  );
}
