import { describe, expect, it } from "vitest";

import { ST, availableActions, canRun, parseLifecycleStatus, stateLabel, summarizeOutcome, validateAddress } from "../logic";

describe("lifecycle model", () => {
  it("offers the right moves per state", () => {
    expect(availableActions(ST.MINTED, null).map((a) => a.kind)).toEqual(["bind", "recycle"]);
    expect(availableActions(ST.BOUND, null).map((a) => a.kind)).toEqual(["activate", "flag", "void-remint", "recycle"]);
    expect(availableActions(ST.ACTIVATED, "not_for_sale").map((a) => a.kind)).toEqual(["list", "settle", "flag", "void-remint", "recycle"]);
    expect(availableActions(ST.ACTIVATED, "listed").map((a) => a.kind)).toEqual(["update-price", "delist", "settle", "flag", "void-remint", "recycle"]);
    expect(availableActions(ST.CLAIMED, "sold").map((a) => a.kind)).toEqual(["flag", "recycle"]);
    expect(availableActions(ST.FLAGGED, null).map((a) => a.kind)).toEqual(["resolve", "recycle"]);
    expect(availableActions(ST.RECYCLED, null)).toEqual([]);
    expect(availableActions(null, null)).toEqual([]);
  });

  it("gates by role tier", () => {
    const [activate, flag, , recycle] = availableActions(ST.BOUND, null);
    expect(canRun(activate!, "editor")).toBe(true);
    expect(canRun(flag!, "viewer")).toBe(false);
    expect(canRun(recycle!, "editor")).toBe(false);
    expect(canRun(recycle!, "admin")).toBe(true);
    expect(recycle!.irreversible).toBe(true);
    expect(flag!.needsReason).toBe(true);
  });

  it("parses the status DTO and validates addresses", () => {
    const s = parseLifecycleStatus({ tokenId: "55", state: 5, stateName: "FLAGGED", owner: "0xabc", saleState: "listed", preFlagState: 4, preFlagStateName: "CLAIMED", approvals: 1, quorum: 2, recipient: "0xabc", quorumReached: false });
    expect(s).toMatchObject({ state: 5, preFlagStateName: "CLAIMED", approvals: 1, quorumReached: false, saleState: "listed" });
    expect(parseLifecycleStatus({ ok: false })).toBeNull();
    expect(stateLabel(3)).toBe("ACTIVATED");
    expect(validateAddress("0x3Ed1b3e5a1eCe81891Bde8e6821029305eB0F113").address).toBe("0x3Ed1b3e5a1eCe81891Bde8e6821029305eB0F113");
    expect(validateAddress("nope").error).toMatch(/0x/);
  });

  it("summarizes relayer responses", () => {
    expect(summarizeOutcome("flag", { ok: true, flagged: ["58"], delisted: ["58"], skipped: [{ reason: "x" }] }, true).lines).toEqual(["Flagged #58", "Removed from sale", "Skipped: x"]);
    expect(summarizeOutcome("recycle", { ok: true, previousState: "BOUND", delisted: false }, true).lines).toEqual(["BOUND → RECYCLED"]);
    expect(summarizeOutcome("resolve", { ok: true, resolved: false, approvals: 1, quorum: 2, note: "wait" }, true).lines).toEqual(["Approvals 1/2 — wait"]);
    expect(summarizeOutcome("resolve", { ok: true, resolved: true, restoredState: "CLAIMED", recipient: "0xabc" }, true).lines[0]).toContain("back to CLAIMED");
    expect(summarizeOutcome("delist", { ok: true, listingStatus: "delisted", version: 3 }, true).lines).toEqual(["Listing delisted (v3)"]);
    expect(summarizeOutcome("update-price", { ok: true, listingStatus: "listed", priceUsdc6: "25000000", version: 4 }, true).lines).toEqual(["Listing listed at 25.00 USDC (v4)"]);
    expect(summarizeOutcome("settle", { ok: false, error: "NOT_FOR_SALE" }, false)).toMatchObject({ ok: false, lines: ["NOT_FOR_SALE"] });
    expect(summarizeOutcome("activate", { ok: true, activated: [], alreadyActive: ["58"], listed: ["58"] }, true).lines).toEqual(["Already active", "Listed for sale"]);
  });
});
