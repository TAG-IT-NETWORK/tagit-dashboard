import { StationLanding } from "@/components/binding/station-landing";

export const dynamic = "force-dynamic";

/**
 * /station — the front door to the binding station. Lists every batch with
 * its chip progress so an operator opens the right station in one click
 * instead of navigating Catalog → template → Batch → Bind.
 */
export default function StationPage() {
  return <StationLanding />;
}
