import { describe, expect, it } from "vitest";

import { WARM_TAP_QUERY, warmTargets } from "../warm";

const CONFIG = {
  self: "https://verify.tagit.network",
  services: "https://api.tagit.network",
  tokenId: "58",
};

describe("warmTargets", () => {
  it("covers both tap entry points, the price proxy and the item record", () => {
    const targets = warmTargets(CONFIG, 1_794_000_000_000);

    expect(targets).toEqual([
      `https://verify.tagit.network/sun?${WARM_TAP_QUERY}`,
      `https://verify.tagit.network/api/verify?${WARM_TAP_QUERY}`,
      "https://verify.tagit.network/api/asset/58/price",
      "https://api.tagit.network/api/v1/assets/58?currency=EUR&view=lean&warm=1794000000000",
    ]);
  });

  it("warms the lean item record, the one a tap reads", () => {
    const record = new URL(warmTargets(CONFIG).at(-1)!);
    expect(record.searchParams.get("view")).toBe("lean");
  });

  it("changes the services URL on every run, so the edge cache cannot answer it", () => {
    const first = warmTargets(CONFIG, 1).at(-1);
    const second = warmTargets(CONFIG, 2).at(-1);
    expect(first).not.toBe(second);
  });

  it("uses a tap payload that cannot pass the tag check", () => {
    const params = new URLSearchParams(WARM_TAP_QUERY);
    // Right shape (32 + 16 hex), wrong content: the check fails before any chain read.
    expect(params.get("picc")).toMatch(/^[0-9a-f]{32}$/);
    expect(params.get("cmac")).toMatch(/^[0-9a-f]{16}$/);
  });
});
