import { describe, expect, it } from "vitest";

import {
  aggregateCatalog,
  lifecycleDistribution,
  needsAttention,
  parseDashboardStats,
  parseRecentBatches,
} from "../stats";

const NOW = new Date("2026-09-05T18:00:00.000Z");

const item = (over: Record<string, unknown> = {}) => ({
  tokenId: "55",
  name: "PDRN Cream",
  lifecycle: "anchored",
  bound: true,
  saleState: "listed",
  anchorStatus: "confirmed",
  drift: false,
  reanchorPending: false,
  needsProductInfo: false,
  updatedAt: "2026-09-05T16:00:00.000Z",
  ...over,
});

describe("aggregateCatalog", () => {
  it("counts lifecycles, tags, listings, attention flags and 24h changes from real rows", () => {
    const stats = aggregateCatalog(
      [
        item(),
        item({ tokenId: "56", saleState: "sold" }),
        item({ tokenId: "57", lifecycle: "recycled", saleState: "not_for_sale", drift: true }),
        item({ tokenId: "58", lifecycle: "minted", bound: false, saleState: null, needsProductInfo: true, updatedAt: "2026-09-01T00:00:00.000Z" }),
        item({ tokenId: "59", lifecycle: "bound", reanchorPending: true, saleState: null }),
        { garbage: true },
        null,
      ],
      NOW,
    );
    expect(stats.totalItems).toBe(5);
    expect(stats.byLifecycle).toEqual({ draft: 0, minted: 1, bound: 1, anchored: 2, recycled: 1 });
    expect(stats.boundCount).toBe(4);
    expect(stats.listedCount).toBe(1);
    expect(stats.soldCount).toBe(1);
    expect(stats.driftCount).toBe(1);
    expect(stats.reanchorPendingCount).toBe(1);
    expect(stats.needsProductInfoCount).toBe(1);
    expect(stats.changedLast24h).toBe(4);
    expect(needsAttention(stats)).toBe(3);
    expect(stats.truncated).toBe(false);
  });

  it("orders recent changes newest-first and caps them", () => {
    const stats = aggregateCatalog(
      [
        item({ tokenId: "1", updatedAt: "2026-09-05T10:00:00.000Z" }),
        item({ tokenId: "2", updatedAt: "2026-09-05T12:00:00.000Z" }),
        item({ tokenId: "3", updatedAt: "2026-09-05T11:00:00.000Z" }),
      ],
      NOW,
      { recentLimit: 2, truncated: true },
    );
    expect(stats.recent.map((r) => r.tokenId)).toEqual(["2", "3"]);
    expect(stats.truncated).toBe(true);
  });
});

describe("lifecycleDistribution", () => {
  it("emits only non-zero slices with stable color keys", () => {
    const stats = aggregateCatalog([item(), item({ tokenId: "58", lifecycle: "minted" })], NOW);
    expect(lifecycleDistribution(stats)).toEqual([
      { name: "Minted", value: 1, state: 1 },
      { name: "Anchored", value: 1, state: 3 },
    ]);
  });
});

describe("parsers", () => {
  it("parseRecentBatches keeps well-formed rows up to the limit", () => {
    const out = parseRecentBatches(
      { ok: true, batches: [{ id: "bat_1", templateId: "tpl_1", quantity: 3, state: "minted", createdAt: "x" }, { id: 5 }, { id: "bat_2", size: 1, state: "minting" }] },
      1,
    );
    expect(out).toEqual([{ id: "bat_1", templateId: "tpl_1", size: 3, state: "minted", createdAt: "x" }]);
    expect(parseRecentBatches({ ok: false })).toEqual([]);
  });

  it("parseDashboardStats rejects non-envelopes", () => {
    expect(parseDashboardStats({ ok: false })).toBeNull();
    const stats = aggregateCatalog([item()], NOW);
    expect(parseDashboardStats({ ok: true, generatedAt: "t", catalog: stats, batches: [], warnings: [] })).toMatchObject({ ok: true, catalog: { totalItems: 1 } });
  });
});
