import { AssetDetail } from "@/components/assets/asset-detail";
import { getActorRole } from "@/lib/actor-role";

export const dynamic = "force-dynamic";

/** /assets/[id] — on-chain detail + the lifecycle controls (role from the session). */
export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const role = await getActorRole();
  return <AssetDetail id={params.id} role={role} />;
}
