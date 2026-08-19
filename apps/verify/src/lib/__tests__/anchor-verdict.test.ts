import { describe, it, expect } from "vitest";
import { anchorVerdict } from "../anchor-verdict";

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
