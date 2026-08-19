import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  MAX_SKEW_MS,
  parseRevalidatePayload,
  ReplayGuard,
  signBody,
  verifySignature,
} from "../revalidate-guard";

const SECRET = "test-secret";

function makeBody(overrides: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    id: "11111111-2222-3333-4444-555555555555",
    event: "price.updated",
    tokenIds: ["5"],
    ts: Date.now(),
    ...overrides,
  });
}

describe("verifySignature", () => {
  it("accepts the emitter's exact HMAC-SHA256 hex signature over the raw body", () => {
    const raw = makeBody();
    // Independent reimplementation of the tagit-services emitter's signer.
    const sig = createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
    expect(verifySignature(raw, sig, SECRET)).toBe(true);
  });

  it("accepts an uppercase-hex signature (case-insensitive header)", () => {
    const raw = makeBody();
    expect(verifySignature(raw, signBody(raw, SECRET).toUpperCase(), SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const raw = makeBody();
    expect(verifySignature(raw, signBody(raw, "other-secret"), SECRET)).toBe(false);
  });

  it("rejects when the body was tampered after signing", () => {
    const raw = makeBody();
    const sig = signBody(raw, SECRET);
    const tampered = raw.replace('"5"', '"6"');
    expect(verifySignature(tampered, sig, SECRET)).toBe(false);
  });

  it("rejects missing or malformed signature headers", () => {
    const raw = makeBody();
    expect(verifySignature(raw, null, SECRET)).toBe(false);
    expect(verifySignature(raw, undefined, SECRET)).toBe(false);
    expect(verifySignature(raw, "", SECRET)).toBe(false);
    expect(verifySignature(raw, "not-hex", SECRET)).toBe(false);
    expect(verifySignature(raw, "deadbeef", SECRET)).toBe(false); // wrong length
  });
});

describe("parseRevalidatePayload", () => {
  it("parses a valid payload", () => {
    const now = 1_700_000_000_000;
    const raw = makeBody({ ts: now });
    const parsed = parseRevalidatePayload(raw, now);
    expect(parsed).toEqual({
      ok: true,
      payload: {
        id: "11111111-2222-3333-4444-555555555555",
        event: "price.updated",
        tokenIds: ["5"],
        ts: now,
      },
    });
  });

  it("rejects a stale ts beyond the 5-minute skew window (replay protection)", () => {
    const now = 1_700_000_000_000;
    const raw = makeBody({ ts: now - MAX_SKEW_MS - 1 });
    expect(parseRevalidatePayload(raw, now)).toEqual({ ok: false, error: "stale" });
  });

  it("rejects a future ts beyond the skew window", () => {
    const now = 1_700_000_000_000;
    const raw = makeBody({ ts: now + MAX_SKEW_MS + 1 });
    expect(parseRevalidatePayload(raw, now)).toEqual({ ok: false, error: "stale" });
  });

  it("rejects malformed bodies", () => {
    expect(parseRevalidatePayload("not json").ok).toBe(false);
    expect(parseRevalidatePayload("null").ok).toBe(false);
    expect(parseRevalidatePayload(makeBody({ id: "" })).ok).toBe(false);
    expect(parseRevalidatePayload(makeBody({ tokenIds: [] })).ok).toBe(false);
    expect(parseRevalidatePayload(makeBody({ tokenIds: ["abc"] })).ok).toBe(false);
    expect(parseRevalidatePayload(makeBody({ tokenIds: [5] })).ok).toBe(false);
    expect(parseRevalidatePayload(makeBody({ ts: "yesterday" })).ok).toBe(false);
  });
});

describe("ReplayGuard", () => {
  it("flags a duplicate id the second time (replay)", () => {
    const guard = new ReplayGuard();
    expect(guard.seenBefore("evt-1")).toBe(false);
    expect(guard.seenBefore("evt-1")).toBe(true);
    expect(guard.seenBefore("evt-2")).toBe(false);
  });

  it("evicts the oldest entry beyond capacity (LRU)", () => {
    const guard = new ReplayGuard(2);
    guard.seenBefore("a");
    guard.seenBefore("b");
    guard.seenBefore("c"); // evicts "a"
    expect(guard.size).toBe(2);
    expect(guard.seenBefore("a")).toBe(false); // forgotten → treated as new
    expect(guard.seenBefore("c")).toBe(true); // still remembered
  });
});
