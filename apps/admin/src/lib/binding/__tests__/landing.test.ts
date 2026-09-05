import { describe, expect, it } from "vitest";

import {
  batchWizardHref,
  parseBatchListRows,
  parseTemplateNames,
  sortForStation,
  stationHref,
  summarizeBatch,
  type BatchListRow,
} from "../landing";

const row = (over: Partial<BatchListRow> = {}): BatchListRow => ({
  id: "bat_A1",
  templateId: "tpl_1",
  size: 3,
  state: "minted",
  createdAt: "2026-09-05T10:00:00.000Z",
  ...over,
});

const status = (lifecycles: string[]) => ({
  ok: true,
  progress: {
    tokens: lifecycles.map((lifecycle, i) => ({ tokenId: String(55 + i), lifecycle, tagUid: null, serial: null })),
  },
});

describe("parseBatchListRows", () => {
  it("keeps templateId and accepts quantity or size", () => {
    const rows = parseBatchListRows({
      ok: true,
      batches: [
        { id: "bat_A1", templateId: "tpl_1", quantity: 3, state: "minted", createdAt: "2026-09-05T10:00:00.000Z" },
        { id: "bat_B2", size: 2, state: "minting" },
        { id: "nope", quantity: 1, state: "minted" },
        { id: "bat_C3", state: "minted" }, // no size → dropped
      ],
    });
    expect(rows).toEqual([
      row(),
      { id: "bat_B2", templateId: null, size: 2, state: "minting", createdAt: "" },
    ]);
    expect(parseBatchListRows({ ok: false })).toBeNull();
    expect(parseBatchListRows(null)).toBeNull();
  });
});

describe("parseTemplateNames", () => {
  it("maps id → name and ignores malformed rows", () => {
    const names = parseTemplateNames({ ok: true, templates: [{ id: "tpl_1", name: "PDRN Cream" }, { id: 5 }] });
    expect(names.get("tpl_1")).toBe("PDRN Cream");
    expect(names.size).toBe(1);
    expect(parseTemplateNames(null).size).toBe(0);
  });
});

describe("summarizeBatch", () => {
  it("counts unbound (minted), bound (bound/anchored) and recycled tokens", () => {
    const s = summarizeBatch(row(), status(["anchored", "anchored", "recycled", "minted"]), "PDRN Cream");
    expect(s).toMatchObject({ templateName: "PDRN Cream", unbound: 1, bound: 2, recycled: 1, total: 4, unknown: false });
  });

  it("flags an unreadable status instead of pretending the batch is complete", () => {
    const s = summarizeBatch(row(), { ok: false }, null);
    expect(s).toMatchObject({ unknown: true, unbound: 0, total: 0 });
  });
});

describe("sortForStation", () => {
  it("puts batches that still need chips first, most-unbound then newest", () => {
    const done = { ...summarizeBatch(row({ id: "bat_D", createdAt: "2026-09-05T12:00:00.000Z" }), status(["anchored"]), null) };
    const one = { ...summarizeBatch(row({ id: "bat_O", createdAt: "2026-09-01T12:00:00.000Z" }), status(["minted", "bound"]), null) };
    const two = { ...summarizeBatch(row({ id: "bat_T", createdAt: "2026-09-03T12:00:00.000Z" }), status(["minted", "minted"]), null) };
    const twoNewer = { ...summarizeBatch(row({ id: "bat_N", createdAt: "2026-09-04T12:00:00.000Z" }), status(["minted", "minted"]), null) };
    expect(sortForStation([done, one, two, twoNewer]).map((b) => b.id)).toEqual(["bat_N", "bat_T", "bat_O", "bat_D"]);
  });
});

describe("hrefs", () => {
  it("point at the existing station and wizard routes", () => {
    expect(stationHref("tpl_1", "bat_A1")).toBe("/catalog/tpl_1/batch/bind?batch=bat_A1");
    expect(batchWizardHref("tpl_1", "bat_A1")).toBe("/catalog/tpl_1/batch?batch=bat_A1");
  });
});
