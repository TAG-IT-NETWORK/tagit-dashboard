import { describe, expect, it } from "vitest";

import {
  computeVerdict,
  interpretScan,
  readDetail,
  readServerCheck,
  tagHashFromUid,
  uidsMatch,
  type ScanInterpretation,
} from "../desktop";

const UID = "04:72:70:8A:FF:18:90";
const SUN = { uid: UID, counter: 7, cmac: "6A23D492FBCBFB8C", picc: "AB".repeat(16), cmacVerified: true };
const sunScan = (over: Partial<typeof SUN> = {}): ScanInterpretation =>
  interpretScan({ records: [{ recordType: "url", data: `https://verify.tagit.network/sun?picc=${"AB".repeat(16)}&cmac=6A23D492FBCBFB8C` }], sun: { ...SUN, ...over } });

describe("interpretScan", () => {
  it("classifies blank, foreign, undecoded and decoded chips", () => {
    expect(interpretScan({ records: [], sun: null })).toEqual({ kind: "blank", records: 0 });
    expect(interpretScan({ records: [{ recordType: "url", data: "https://example.com" }], sun: null })).toMatchObject({ kind: "not-sun", url: "https://example.com" });
    expect(interpretScan({ records: [{ recordType: "url", data: `https://verify.tagit.network/sun?picc=${"AB".repeat(16)}&cmac=0000000000000000` }], sun: null, sunError: "different master key" })).toMatchObject({ kind: "undecoded", reason: "different master key" });
    expect(sunScan()).toMatchObject({ kind: "sun", sun: { uid: UID, counter: 7, cmacVerified: true } });
    expect(interpretScan(null)).toEqual({ kind: "blank", records: 0 });
  });
});

describe("tagHashFromUid", () => {
  it("hashes the raw UID bytes (matches the relayer's canonical tagHash)", () => {
    // Token 55's live tag: chip 04:72:70:8A:FF:18:90 → 0xb866f7cf…
    expect(tagHashFromUid(UID)?.startsWith("0xb866f7cf6bedf2a12b75c646f3cd922bc701edc847a1e366004b91d1736864a8")).toBe(true);
    expect(tagHashFromUid("nope")).toBeNull();
    expect(uidsMatch(UID, "0472708aff1890")).toBe(true);
    expect(uidsMatch(UID, "04:72:70:8A:FF:18:91")).toBe(false);
  });
});

describe("readDetail", () => {
  it("picks the product, chain, price, verification and provenance fields tolerantly", () => {
    const d = readDetail({
      tokenId: "55",
      owner: "0x3Ed1…F113",
      stateCode: 4,
      lifecycleState: "CLAIMED",
      name: "PDRN Cream",
      image: "https://media.tagit.network/i/x/lg.webp",
      description: "Eye Cream 100, 50 ml.",
      tagHash: "0xb866",
      timestamp: 1788627276,
      attributes: [{ trait_type: "Brand", value: "PDRN" }, { bad: true }],
      product: { brand: "PDRN", model: "PDRN Cream", sku: "3333-2002", origin: "South Korea", category: "Cosmetics" },
      price: { display: "$23.33", saleState: "sold" },
      verification: { anchoredVersion: 3, latestVersion: 3, anchorStatus: "confirmed", metadataHash: "0xfe93", verified: true },
      provenance: [{ type: "AssetMinted", label: "Minted", blockNumber: 1, txHash: "0xabc", timestamp: 1 }],
    });
    expect(d).toMatchObject({
      tokenId: "55",
      stateCode: 4,
      name: "PDRN Cream",
      product: { brand: "PDRN", sku: "3333-2002" },
      price: { display: "$23.33", saleState: "sold" },
      verification: { anchoredVersion: 3, verified: true },
    });
    expect(d?.attributes).toEqual([{ trait_type: "Brand", value: "PDRN" }]);
    expect(d?.provenance).toHaveLength(1);
    expect(readDetail({ error: "nope" })).toBeNull();
  });
});

describe("computeVerdict", () => {
  const detail = readDetail({ tokenId: "55", stateCode: 4, lifecycleState: "CLAIMED" });
  it("is authentic for a valid, bound, live token", () => {
    const v = computeVerdict({ scan: sunScan(), cardUid: UID, tokenId: 55n, detail, server: readServerCheck(200, { verified: true, cmacVerified: true }) });
    expect(v.level).toBe("authentic");
    expect(v.reason).toMatch(/#55/);
    expect(v.reason).toMatch(/server CMAC verified/);
  });
  it("is tamper on UID mismatch, bad local CMAC, or server CMAC_INVALID — regardless of the token", () => {
    expect(computeVerdict({ scan: sunScan(), cardUid: "04:00:00:00:00:00:01", tokenId: 55n, detail, server: null }).level).toBe("tamper");
    expect(computeVerdict({ scan: sunScan({ cmacVerified: false }), cardUid: UID, tokenId: 55n, detail, server: null }).level).toBe("tamper");
    expect(computeVerdict({ scan: sunScan(), cardUid: UID, tokenId: 55n, detail, server: readServerCheck(200, { verified: false, reason: "CMAC_INVALID" }) }).level).toBe("tamper");
  });
  it("warns for genuine-but-unbound, flagged and recycled items", () => {
    expect(computeVerdict({ scan: sunScan(), cardUid: UID, tokenId: 0n, detail: null, server: null })).toMatchObject({ level: "warning", title: "Genuine chip, not bound" });
    expect(computeVerdict({ scan: sunScan(), cardUid: UID, tokenId: 57n, detail: readDetail({ tokenId: "57", stateCode: 6 }), server: null })).toMatchObject({ level: "warning", title: "RECYCLED asset" });
    expect(computeVerdict({ scan: sunScan(), cardUid: UID, tokenId: 9n, detail: readDetail({ tokenId: "9", stateCode: 5 }), server: null })).toMatchObject({ level: "warning", title: "FLAGGED asset" });
  });
  it("is unknown for blank / foreign chips and while resolving", () => {
    expect(computeVerdict({ scan: interpretScan({ records: [] }), cardUid: UID, tokenId: null, detail: null, server: null })).toMatchObject({ level: "unknown", title: "Blank chip" });
    expect(computeVerdict({ scan: sunScan(), cardUid: UID, tokenId: null, detail: null, server: null }).level).toBe("unknown");
  });
  it("a viewer-role 403 on the server check does not downgrade a locally verified chip", () => {
    const v = computeVerdict({ scan: sunScan(), cardUid: UID, tokenId: 55n, detail, server: readServerCheck(403, { ok: false }) });
    expect(v.level).toBe("authentic");
    expect(readServerCheck(403, {}).skipped).toMatch(/operator/);
  });
});
