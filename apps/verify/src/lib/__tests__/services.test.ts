import { afterEach, describe, expect, it, vi } from "vitest";

import { loadProduct } from "../dpp";
import {
  assetProvenanceUrl,
  assetUrl,
  fetchAsset,
  fetchAssetProvenance,
  SERVICES_URL,
} from "../services";

/** Stub global fetch with one canned answer; returns the mock for inspection. */
function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(async (_input: unknown, _init?: unknown) => {
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const requestedUrls = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.map(([input]) => String(input));

const RECORD = {
  tokenId: "58",
  stateCode: 4,
  name: "Renewal Cream",
  description: "A daily face cream.",
  product: { name: "Renewal Cream", brand: "TAG IT Demo", sku: "TD-50", origin: "KR" },
  media: [{ role: "hero", url: "https://media.tagit.network/i/abc/lg.webp", mime: "image/webp" }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the item record this host reads (TAP-T06)", () => {
  it("is the LEAN view — the full view scans the explorer and made taps slow", () => {
    const url = new URL(assetUrl("58"));
    expect(url.origin + url.pathname).toBe(`${SERVICES_URL}/api/v1/assets/58`);
    expect(url.searchParams.get("view")).toBe("lean");
    expect(url.searchParams.get("currency")).toBe("EUR");
  });

  it("fetchAsset requests exactly that URL and returns the record", async () => {
    const fetchMock = stubFetch(RECORD);

    const lookup = await fetchAsset("58");

    expect(requestedUrls(fetchMock)).toEqual([assetUrl("58")]);
    expect(lookup).toEqual({ kind: "record", dto: RECORD });
  });

  it("passes a timeout signal, so a hung services call cannot hang a tap", async () => {
    const fetchMock = stubFetch(RECORD);

    await fetchAsset("58");

    const init = fetchMock.mock.calls[0]![1] as { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps restricted, missing and failing answers without throwing", async () => {
    stubFetch({ tokenId: "5", restricted: true });
    expect((await fetchAsset("5")).kind).toBe("restricted");

    stubFetch({ error: "NOT_FOUND" }, 404);
    expect(await fetchAsset("999")).toEqual({ kind: "none" });

    stubFetch("upstream exploded", 502);
    expect(await fetchAsset("58")).toEqual({ kind: "unavailable" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }),
    );
    expect(await fetchAsset("58")).toEqual({ kind: "unavailable" });
  });

  it("never calls out for something that is not a token id", async () => {
    const fetchMock = stubFetch(RECORD);

    expect(await fetchAsset("58; drop")).toEqual({ kind: "none" });
    expect(await fetchAssetProvenance("abc")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchAssetProvenance", () => {
  const HISTORY = [
    {
      type: "AssetMinted",
      label: "Minted",
      blockNumber: 100,
      txHash: "0xaa",
      data: { to: "0xA1" },
    },
    {
      type: "StateChanged",
      label: "NONE → MINTED",
      blockNumber: 100,
      txHash: "0xaa",
      data: { from: 0, to: 1 },
    },
  ];

  it("reads the history route, not the item record", async () => {
    const fetchMock = stubFetch({ tokenId: "58", chainId: 84532, provenance: HISTORY });

    const entries = await fetchAssetProvenance("58");

    expect(requestedUrls(fetchMock)).toEqual([assetProvenanceUrl("58")]);
    expect(assetProvenanceUrl("58")).toBe(`${SERVICES_URL}/api/v1/assets/58/provenance`);
    expect(entries).toEqual(HISTORY);
  });

  it("passes a timeout signal, so a hung history call still ends", async () => {
    const fetchMock = stubFetch({ tokenId: "58", chainId: 84532, provenance: HISTORY });

    await fetchAssetProvenance("58");

    const init = fetchMock.mock.calls[0]![1] as { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null for the protected envelope, an error, a bad body or a network failure", async () => {
    stubFetch({ tokenId: "5", restricted: true, verification: { status: "protected" } });
    expect(await fetchAssetProvenance("5")).toBeNull();

    stubFetch({ error: "NOT_FOUND" }, 404);
    expect(await fetchAssetProvenance("999")).toBeNull();

    stubFetch("not json");
    expect(await fetchAssetProvenance("58")).toBeNull();

    stubFetch({ provenance: "nope" });
    expect(await fetchAssetProvenance("58")).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await fetchAssetProvenance("58")).toBeNull();
  });
});

describe("loadProduct — product copy comes only from the item's record", () => {
  it("maps the record and makes exactly one request, to the item record", async () => {
    const fetchMock = stubFetch(RECORD);

    const product = await loadProduct("58");

    expect(requestedUrls(fetchMock)).toEqual([assetUrl("58")]);
    expect(product).toEqual({
      name: "Renewal Cream",
      brand: "TAG IT Demo",
      description: "A daily face cream.",
      image: "https://media.tagit.network/i/abc/lg.webp",
      images: ["https://media.tagit.network/i/abc/lg.webp"],
      sku: "TD-50",
      origin: "KR",
    });
  });

  it("takes one argument: there is no second source to pass in", () => {
    expect(loadProduct.length).toBe(1);
  });

  it("is empty for restricted items and when services is down", async () => {
    stubFetch({ tokenId: "5", restricted: true, name: "TAG IT Protected Asset" });
    expect(await loadProduct("5")).toEqual({});

    stubFetch("boom", 500);
    expect(await loadProduct("58")).toEqual({});
  });
});
