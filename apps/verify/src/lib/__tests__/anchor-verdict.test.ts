import { describe, it, expect } from "vitest";
import { anchorVerdict, newerVersionPropagating } from "../anchor-verdict";

describe("anchorVerdict — tri-state metadata band", () => {
  it("green when the API says verified", () => {
    expect(
      anchorVerdict({
        anchoredVersion: 2,
        latestVersion: 2,
        anchorStatus: "confirmed",
        metadataHash: "0x" + "a".repeat(64),
        verified: true,
      }).tone,
    ).toBe("green");
  });

  it("yellow when the anchor is pending", () => {
    expect(
      anchorVerdict({
        anchoredVersion: null,
        latestVersion: 1,
        anchorStatus: "pending",
        metadataHash: null,
        verified: false,
      }),
    ).toMatchObject({ tone: "yellow", label: "Not yet anchored" });
  });

  it("yellow when the metadata hash is zero/absent", () => {
    expect(
      anchorVerdict({
        anchoredVersion: null,
        latestVersion: null,
        anchorStatus: "confirmed",
        metadataHash: "0x" + "0".repeat(64),
        verified: false,
      }).tone,
    ).toBe("yellow");
    expect(
      anchorVerdict({
        anchoredVersion: null,
        latestVersion: null,
        anchorStatus: null,
        metadataHash: null,
        verified: false,
      }).tone,
    ).toBe("yellow");
  });

  it("yellow when there is no verification block at all", () => {
    expect(anchorVerdict(undefined).tone).toBe("yellow");
    expect(anchorVerdict(null).tone).toBe("yellow");
  });

  it("red on mismatch: anchored but served doc does not match", () => {
    expect(
      anchorVerdict({
        anchoredVersion: 1,
        latestVersion: 2,
        anchorStatus: "confirmed",
        metadataHash: "0x" + "a".repeat(64),
        verified: false,
      }),
    ).toMatchObject({ tone: "red", label: "Metadata verification FAILED" });
  });
});

describe("newerVersionPropagating — META-T37 hint predicate", () => {
  const block = (latestVersion: number | null, anchoredVersion: number | null) => ({
    anchoredVersion,
    latestVersion,
    anchorStatus: "confirmed",
    metadataHash: "0x" + "a".repeat(64),
    verified: false,
  });

  it("true only when latestVersion > anchoredVersion", () => {
    expect(newerVersionPropagating(block(2, 1))).toBe(true);
    expect(newerVersionPropagating(block(2, 2))).toBe(false);
    expect(newerVersionPropagating(block(1, 2))).toBe(false);
  });

  it("false when either version is missing — that is 'not yet anchored', not 'propagating'", () => {
    expect(newerVersionPropagating(block(2, null))).toBe(false);
    expect(newerVersionPropagating(block(null, 1))).toBe(false);
    expect(newerVersionPropagating(block(null, null))).toBe(false);
  });

  it("false without a verification block", () => {
    expect(newerVersionPropagating(undefined)).toBe(false);
    expect(newerVersionPropagating(null)).toBe(false);
  });

  it("never changes the tri-state verdict — the band stays authoritative", () => {
    // Same DTO drives both: a propagating newer version can coexist with a
    // green band (verified snapshot) and the hint must not depend on tone.
    const verified = { ...block(3, 2), verified: true };
    expect(anchorVerdict(verified).tone).toBe("green");
    expect(newerVersionPropagating(verified)).toBe(true);
  });
});
