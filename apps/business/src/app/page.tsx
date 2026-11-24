import { MarketingLanding } from "@/components/marketing-landing";

/**
 * The public landing page. Anyone may see it; it reads no session and asks
 * for no wallet. A signed-in brand user never lands here: the middleware
 * sends them to their home (TAP-T17).
 */
export default function Home() {
  return <MarketingLanding />;
}
