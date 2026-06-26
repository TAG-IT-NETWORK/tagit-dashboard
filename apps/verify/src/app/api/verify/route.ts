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
 *   resolved        → 200 { verified, bound:true, uid, tapCounter, asset{...}, metadataHash, chain }
 *   authentic-unbound→200 { verified:false, bound:false, uid, tapCounter, reason }
 *   counterfeit     → 200 { verified:false, reason }
 *   bad params      → 400 { verified:false, error }
 *   not configured  → 503 { verified:false, error }
 *   lookup failed   → 502 { verified:false, error }
 */
import { resolveTap, isAuthenticState } from "@/lib/resolve";
import { loadProduct, CHAIN_ID, CHAIN_NAME } from "@/lib/dpp";
import { STATES } from "@/lib/states";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*", "cache-control": "no-store" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const picc = url.searchParams.get("picc") ?? undefined;
  const cmac = url.searchParams.get("cmac") ?? undefined;
  const meta = url.searchParams.get("meta");

  const res = await resolveTap(picc, cmac);
  const chain = { id: CHAIN_ID, name: CHAIN_NAME };

  switch (res.kind) {
    case "bad-params":
      return json({ verified: false, error: "missing picc or cmac query params" }, 400);
    case "not-configured":
      return json({ verified: false, error: "verifier not configured (SDM_MASTER_KEY unset)" }, 503);
    case "counterfeit":
      return json({ verified: false, reason: res.reason, chain });
    case "authentic-unbound":
      return json({
        verified: false,
        bound: false,
        uid: res.uid,
        tapCounter: res.counter,
        reason: "Chip authentic but not yet bound on-chain",
        chain,
      });
    case "lookup-failed":
      return json({ verified: false, error: res.reason, uid: res.uid, tapCounter: res.counter, chain }, 502);
    case "resolved": {
      const product = await loadProduct(res.tokenId.toString(), meta);
      return json({
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
      });
    }
  }
}
