import { describe, expect, it } from "vitest";

import { servicesProvenanceToWire } from "../provenance-wire";

const label = (c: number) => ["NONE", "MINTED", "BOUND", "ACTIVATED", "CLAIMED"][c] ?? "UNKNOWN";

describe("servicesProvenanceToWire", () => {
  it("maps the services list into timeline events, chronological, with state labels", () => {
    const wire = servicesProvenanceToWire(
      [
        { type: "StateChanged", blockNumber: 46426658, txHash: "0xbb", data: { from: 2, to: 3 } },
        { type: "AssetMinted", blockNumber: 46389487, txHash: "0xaa", data: { to: "0xA1" } },
        { type: "StateChanged", blockNumber: 46389487, txHash: "0xaa", data: { from: 0, to: 1 } },
        { type: "PriceChanged", blockNumber: 1, txHash: "0xcc" },
      ],
      label,
    );
    expect(wire.available).toBe(true);
    if (!wire.available) return;
    expect(wire.events.map((e) => [e.type, e.block_number, e.from_state, e.to_state])).toEqual([
      ["AssetMinted", 46389487, undefined, undefined],
      ["StateChanged", 46389487, "NONE", "MINTED"],
      ["StateChanged", 46426658, "BOUND", "ACTIVATED"],
    ]);
    expect(wire.scan).toEqual({ from_block: 46389487, to_block: 46426658, source: "tagit-services" });
  });

  it("stays unavailable for an empty or unknown-only list", () => {
    expect(servicesProvenanceToWire(undefined, label)).toEqual({ available: false });
    expect(servicesProvenanceToWire([], label)).toEqual({ available: false });
    expect(servicesProvenanceToWire([{ type: "Other", blockNumber: 1, txHash: "0x" }], label)).toEqual({ available: false });
  });
});
