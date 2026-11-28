/**
 * Mobile-friendly SUN verification endpoint.
 *
 *   GET /api/verify?picc=<32 hex>&cmac=<16 hex>
 *
 * The ORACULAR app can't decrypt the chip's PICC blob (no SDM key on device),
 * so it forwards the tap's picc+cmac here. We verify the SUN crypto server-side,
 * resolve the on-chain twin via the decrypted UID, and return a flat JSON the
 * app maps straight onto its Result screen. CORS-open for the native client.
 *
 * Stable contract (do not break without bumping the app):
 *   resolved        → 200 { verified, bound:true, uid, tapCounter, asset{...}, metadataHash, chain, tapLink }
 *   authentic-unbound→200 { verified:false, bound:false, uid, tapCounter, reason }
 *   counterfeit     → 200 { verified:false, reason }
 *   link used       → 200 { verified:false, bound:true, uid, tapCounter, reason, tapLink:"used" }
 *   bad params      → 400 { verified:false, error }
 *   not configured  → 503 { verified:false, error }
 *   lookup failed   → 502 { verified:false, error }
 *   link unchecked  → 503 { verified:false, error }
 *
 * `tapLink` (TAP-T10) is the one field added for one-time links: "fresh" for a
 * link opened for the first time, "again" when the same device opens its own
 * link once more within a few minutes, "used" for a link that was already
 * opened. A used link is never `verified`, so a build of the app that does not
 * know the field still shows it as not verified, with `reason` as the text.
 *
 * Product fields come only from the item's own record: `picc` and `cmac` are
 * the only query parameters this route reads.
 *
 * Every response carries a `Server-Timing` header with the tap's step
 * durations, and every tap writes one log line with the same numbers (see
 * @/lib/tap-timing) — this is the route the TAG IT app calls, so its taps are
 * measured the same way the web page's are.
 */
import { TAP_STATES } from "@/lib/consumer-copy";
import { resolveTap, isAuthenticState } from "@/lib/resolve";
import { loadProduct, CHAIN_ID, CHAIN_NAME, type ProductMetadata } from "@/lib/dpp";
import { STATES } from "@/lib/states";
import { tapCountryOf } from "@/lib/tap-country";
import { tapDeviceOf } from "@/lib/tap-device";
import { createTapTimer, logTap } from "@/lib/tap-timing";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*", "cache-control": "no-store" };

function json(body: unknown, status: number, serverTiming: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...CORS,
      ...(serverTiming ? { "server-timing": serverTiming } : {}),
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const picc = url.searchParams.get("picc") ?? undefined;
  const cmac = url.searchParams.get("cmac") ?? undefined;

  const timer = createTapTimer();
  // The item record only needs the token id, so it is requested the moment the
  // tag resolves — while the asset/anchor chain reads run, not after them.
  let productLookup: Promise<ProductMetadata> | null = null;
  const res = await resolveTap(picc, cmac, {
    onTokenId: (tokenId) => {
      productLookup = timer.time("product", () => loadProduct(tokenId.toString()));
    },
    timer,
    // Lets the same device ask about its own link again for a few minutes.
    device: tapDeviceOf(req.headers),
    // The country only, for the brand's tap numbers (TAP-T18).
    country: tapCountryOf(req.headers),
  });
  if (res.kind !== "resolved") logTap("/api/verify", res.kind, timer);
  const chain = { id: CHAIN_ID, name: CHAIN_NAME };
  const reply = (body: unknown, status = 200) => json(body, status, timer.header());

  switch (res.kind) {
    case "bad-params":
      return reply({ verified: false, error: "missing picc or cmac query params" }, 400);
    case "not-configured":
      return reply(
        { verified: false, error: "verifier not configured (SDM_MASTER_KEY unset)" },
        503,
      );
    case "counterfeit":
      return reply({ verified: false, reason: res.reason, chain });
    case "authentic-unbound":
      return reply({
        verified: false,
        bound: false,
        uid: res.uid,
        tapCounter: res.counter,
        reason: "Chip authentic but not yet bound on-chain",
        chain,
      });
    case "lookup-failed":
      return reply(
        { verified: false, error: res.reason, uid: res.uid, tapCounter: res.counter, chain },
        502,
      );
    case "link-used":
      // The tag is real, but this link was opened before. Never `verified`.
      return reply({
        verified: false,
        bound: true,
        uid: res.uid,
        tapCounter: res.counter,
        reason: `${TAP_STATES.linkUsed.headline}. ${TAP_STATES.linkUsed.line}.`,
        tapLink: "used",
        chain,
      });
    case "link-unchecked":
      // The one-time store did not answer: nothing may be said about the product.
      return reply(
        {
          verified: false,
          error: `${TAP_STATES.ourSide.headline}. ${TAP_STATES.ourSide.line}.`,
          uid: res.uid,
          tapCounter: res.counter,
          chain,
        },
        503,
      );
    case "resolved": {
      const product = await (productLookup ??
        timer.time("product", () => loadProduct(res.tokenId.toString())));
      logTap("/api/verify", res.link.kind === "again" ? "resolved-again" : "resolved", timer);
      return reply({
        verified: isAuthenticState(res.asset.state),
        bound: true,
        uid: res.uid,
        tapCounter: res.counter,
        asset: {
          tokenId: res.tokenId.toString(),
          stateCode: res.asset.state,
          lifecycleState: STATES[res.asset.state]?.label ?? "UNKNOWN",
          owner: res.asset.owner,
          timestamp: Number(res.asset.timestamp),
          name: product.name,
          image: product.image,
          brand: product.brand,
          sku: product.sku,
          origin: product.origin,
          msrp: product.msrp,
        },
        metadataHash: res.metadataHash,
        chain,
        tapLink: res.link.kind,
      });
    }
    default: {
      // Every outcome is handled above; a new one must be added there. If one
      // ever reaches this line the request fails rather than passing.
      const unhandled: never = res;
      throw new Error(`unhandled tap outcome: ${(unhandled as { kind: string }).kind}`);
    }
  }
}
