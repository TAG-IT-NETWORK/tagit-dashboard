import { describe, expect, it } from "vitest";

import { AGENT_CATALOG, FAMILY_ORDER, catalogSummary, filterCatalog } from "../catalog";

describe("agent catalog", () => {
  it("has unique ids, every family represented, and honest statuses", () => {
    const ids = AGENT_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const fam of FAMILY_ORDER) expect(AGENT_CATALOG.some((a) => a.family === fam)).toBe(true);
    expect(AGENT_CATALOG.length).toBeGreaterThanOrEqual(45);
    // live agents point at real code or the chain, never at an idea
    for (const a of AGENT_CATALOG.filter((x) => x.status === "live")) expect(a.source).not.toBe("suggested");
    // runnable skills are only claimed on live/beta cards
    for (const a of AGENT_CATALOG.filter((x) => x.skills?.length)) expect(["live", "beta"]).toContain(a.status);
  });

  it("filters by family, status and text", () => {
    expect(filterCatalog(AGENT_CATALOG, { family: "logistics", status: null, q: "" }).every((a) => a.family === "logistics")).toBe(true);
    expect(filterCatalog(AGENT_CATALOG, { family: null, status: "live", q: "" }).every((a) => a.status === "live")).toBe(true);
    expect(filterCatalog(AGENT_CATALOG, { family: null, status: null, q: "ups" }).map((a) => a.id)).toContain("carrier-ups");
    expect(filterCatalog(AGENT_CATALOG, { family: "system", status: "proposed", q: "" })).toEqual([]);
  });

  it("summarizes counts", () => {
    const s = catalogSummary(AGENT_CATALOG);
    expect(s.total).toBe(AGENT_CATALOG.length);
    expect(s.live + s.beta + s.planned + s.proposed).toBe(s.total);
    expect(s.live).toBeGreaterThanOrEqual(6);
  });
});
