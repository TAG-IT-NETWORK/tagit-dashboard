/**
 * Machine-readable Digital Product Passport endpoint.
 *
 *   GET /api/dpp/01/{GTIN}/21/{serial}?picc=<hex>&cmac=<hex>
 *   GET /api/dpp/token/{tokenId}?picc=<hex>&cmac=<hex>
 *
 * Verifies the SUN tap, resolves the on-chain twin, and returns the passport as
 * a W3C Verifiable Credential (VCDM 2.0 JSON-LD, UNTP DigitalProductPassport).
 * CORS-open so external verifiers / GS1 resolvers can consume it. Unsigned in
 * v1 (integrity via the on-chain anchor in `evidence`); see /lib/dpp.ts.
 */
import { parseGs1Path } from "@/lib/gs1";
import { resolveTap } from "@/lib/resolve";
import { buildDpp, dppToVerifiableCredential, loadProduct } from "@/lib/dpp";

export const dynamic = "force-dynamic";

const JSON_LD_HEADERS = {
  "content-type": "application/ld+json",
  "access-control-allow-origin": "*",
  "x-dpp-proof": "unsigned-anchor-only",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", ...extra },
  });
}

export async function GET(
  req: Request,
  { params }: { params: { segments: string[] } },
) {
  const url = new URL(req.url);
  const picc = url.searchParams.get("picc") ?? undefined;
  const cmac = url.searchParams.get("cmac") ?? undefined;
  const meta = url.searchParams.get("meta");

  const segs = params.segments ?? [];
  const link = segs[0] === "token" ? null : parseGs1Path(segs);

  const res = await resolveTap(picc, cmac);

  switch (res.kind) {
    case "bad-params":
      return json({ verified: false, error: "missing picc or cmac query params" }, 400);
    case "not-configured":
      return json({ verified: false, error: "verifier not configured (SDM_MASTER_KEY unset)" }, 503);
    case "counterfeit":
      return json({ verified: false, reason: res.reason });
    case "authentic-unbound":
      return json({
        verified: true,
        bound: false,
        uid: res.uid,
        tapCounter: res.counter,
        gtin: link?.gtin ?? null,
        serial: link?.serial ?? null,
      });
    case "lookup-failed":
      return json({ verified: true, error: res.reason }, 502);
    case "resolved": {
      const product = await loadProduct(res.tokenId.toString(), meta);
      const dpp = buildDpp({
        gtin: link?.gtin ?? null,
        gtinValid: link?.gtinValid ?? false,
        serial: link?.serial ?? null,
        tokenId: res.tokenId,
        uid: res.uid,
        counter: res.counter,
        asset: res.asset,
        metadataHash: res.metadataHash,
        product,
        verifiedAt: new Date().toISOString(),
      });
      return new Response(JSON.stringify(dppToVerifiableCredential(dpp), null, 2), {
        status: 200,
        headers: JSON_LD_HEADERS,
      });
    }
  }
}
