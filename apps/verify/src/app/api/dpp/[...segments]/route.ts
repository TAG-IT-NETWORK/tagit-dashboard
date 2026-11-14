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
import { buildDpp, dppToVerifiableCredential, loadProduct, type ProductMetadata } from "@/lib/dpp";
import { neverCacheControl } from "@/lib/cache";
import { createTapTimer } from "@/lib/tap-timing";

export const dynamic = "force-dynamic";

/**
 * `no-store` on EVERY response from this route, success and failure alike.
 *
 * `dynamic = "force-dynamic"` only stops Next from caching; it emits no wire
 * header, so before this the endpoint answered with no Cache-Control at all and
 * a shared cache was free to apply heuristic freshness to it. This route is a
 * SUN tap verifier: its answer is only meaningful for the exact tap that
 * produced it, because the monotonic counter inside the decrypted PICC is the
 * anti-replay mechanism. A stored 200 keyed on ?picc=&cmac= turns one captured
 * cryptogram into an unlimited authenticity oracle. `access-control-allow-origin: *`
 * makes that reachable from anywhere. See the boundary note in src/lib/cache.ts.
 */
const NO_STORE = neverCacheControl();

const JSON_LD_HEADERS = {
  "content-type": "application/ld+json",
  "access-control-allow-origin": "*",
  "x-dpp-proof": "unsigned-anchor-only",
  "cache-control": NO_STORE,
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": NO_STORE,
      ...extra,
    },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ segments: string[] }> }) {
  const url = new URL(req.url);
  const picc = url.searchParams.get("picc") ?? undefined;
  const cmac = url.searchParams.get("cmac") ?? undefined;

  const segs = (await params).segments ?? [];
  const link = segs[0] === "token" ? null : parseGs1Path(segs);

  const timer = createTapTimer();
  // The item record only needs the token id, so it is requested the moment the
  // tag resolves — while the asset/anchor chain reads run, not after them.
  // Product fields in the passport come only from that record.
  let productLookup: Promise<ProductMetadata> | null = null;
  const res = await resolveTap(
    picc,
    cmac,
    (tokenId) => {
      productLookup = timer.time("product", () => loadProduct(tokenId.toString()));
    },
    timer,
  );
  const timing = (): Record<string, string> => {
    const value = timer.header();
    return value ? { "server-timing": value } : {};
  };

  switch (res.kind) {
    case "bad-params":
      return json({ verified: false, error: "missing picc or cmac query params" }, 400, timing());
    case "not-configured":
      return json(
        { verified: false, error: "verifier not configured (SDM_MASTER_KEY unset)" },
        503,
        timing(),
      );
    case "counterfeit":
      return json({ verified: false, reason: res.reason }, 200, timing());
    case "authentic-unbound":
      return json(
        {
          verified: true,
          bound: false,
          uid: res.uid,
          tapCounter: res.counter,
          gtin: link?.gtin ?? null,
          serial: link?.serial ?? null,
        },
        200,
        timing(),
      );
    case "lookup-failed":
      return json({ verified: true, error: res.reason }, 502, timing());
    case "resolved": {
      const product = await (productLookup ??
        timer.time("product", () => loadProduct(res.tokenId.toString())));
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
        headers: { ...JSON_LD_HEADERS, ...timing() },
      });
    }
  }
}
