import { describe, expect, it } from "vitest";

import {
  BATCH_ID_RE,
  GRACE_MS,
  canFixLastBind,
  currentToken,
  graceRemainingMs,
  initialStationState,
  interpretNdefRead,
  isEncryptedSunUrl,
  orderBySerial,
  parseBatchTokens,
  parseSunFromUrl,
  pendingQueue,
  stationReducer,
  sunCheckViaBridge,
  sunFromBridgeDecode,
  sunMatchesCard,
  type StationState,
  type StationToken,
} from "../station";

const UID = "04:A1:B2:C3:D4:E5:F6";
const SUN_URL = "https://verify.tagit.network/sun?uid=04A1B2C3D4E5F6&ctr=00000A&cmac=0102030405060708";
/** Encrypted-PICC layout (what the bridge personalizes) — opaque without the master key. */
const ENC_SUN_URL = `https://verify.tagit.network/sun?picc=${"AB".repeat(16)}&cmac=0102030405060708`;
const BRIDGE_SUN = { uid: UID, counter: 10, cmac: "0102030405060708", picc: "AB".repeat(16), cmacVerified: true };

function token(tokenId: string, lifecycle = "minted", serial: string | null = null): StationToken {
  return { tokenId, lifecycle, tagUid: null, serial };
}

/** Drive the reducer through LOAD with a 3-token batch (t1 already bound). */
function loadedState(): StationState {
  return stationReducer(initialStationState, {
    type: "LOAD",
    tokens: [
      token("3", "minted", "SN-10"),
      token("1", "bound", "SN-1"),
      token("2", "minted", "SN-2"),
    ],
  });
}

// ── DTO parsing + queue order ───────────────────────────────────────────────

describe("parseBatchTokens", () => {
  it("extracts tokens from the batch-status DTO", () => {
    const body = {
      batch: { id: "bat_1" },
      progress: {
        expected: 2,
        minted: 2,
        tokens: [
          { tokenId: "1", lifecycle: "minted", tagUid: null, serial: "SN-1" },
          { tokenId: "2", lifecycle: "bound", tagUid: "04:AA", serial: null },
        ],
      },
    };
    expect(parseBatchTokens(body)).toEqual([
      { tokenId: "1", lifecycle: "minted", tagUid: null, serial: "SN-1" },
      { tokenId: "2", lifecycle: "bound", tagUid: "04:AA", serial: null },
    ]);
  });

  it("returns null on a malformed body and skips malformed rows", () => {
    expect(parseBatchTokens(null)).toBeNull();
    expect(parseBatchTokens({})).toBeNull();
    expect(
      parseBatchTokens({ progress: { tokens: [{ tokenId: 7, lifecycle: "minted" }] } }),
    ).toEqual([]);
  });
});

describe("queue order", () => {
  it("natural-sorts by serial (SN-2 before SN-10), serial-less after by tokenId", () => {
    const ordered = orderBySerial([
      token("5", "minted", null),
      token("1", "minted", "SN-10"),
      token("12", "minted", null),
      token("2", "minted", "SN-2"),
    ]);
    expect(ordered.map((t) => t.tokenId)).toEqual(["2", "1", "5", "12"]);
  });

  it("pendingQueue keeps only MINTED tokens — bound/recycled drop out", () => {
    const queue = pendingQueue([
      token("1", "bound", "SN-1"),
      token("2", "minted", "SN-2"),
      token("3", "recycled", "SN-3"),
      token("4", "minted", "SN-4"),
    ]);
    expect(queue.map((t) => t.tokenId)).toEqual(["2", "4"]);
  });

  it("resumes at the first unbound token in serial order (resumability)", () => {
    const state = loadedState();
    expect(currentToken(state)?.tokenId).toBe("2"); // SN-2 before SN-10
    expect(state.phase).toBe("idle");
  });
});

// ── SUN parsing ─────────────────────────────────────────────────────────────

describe("parseSunFromUrl", () => {
  it("parses uid/ctr/cmac (hex ASCII mirrors)", () => {
    expect(parseSunFromUrl(SUN_URL)).toEqual({
      uidHex: "0x04a1b2c3d4e5f6",
      counter: 10,
      cmacHex: "0x0102030405060708",
    });
  });

  it("rejects malformed urls and missing/short params", () => {
    expect(parseSunFromUrl("not a url")).toBeNull();
    expect(parseSunFromUrl("https://x.test/?uid=04A1B2C3D4E5F6&ctr=0A")).toBeNull(); // no cmac
    expect(parseSunFromUrl("https://x.test/?uid=ZZ&ctr=0A&cmac=0102030405060708")).toBeNull();
    // Encrypted PICC layout — not parseable client-side.
    expect(parseSunFromUrl("https://x.test/?picc_data=AABB&cmac=0102030405060708")).toBeNull();
  });
});

describe("sunMatchesCard", () => {
  const sun = parseSunFromUrl(SUN_URL)!;
  it("matches the tapped card's colon-hex UID case-insensitively", () => {
    expect(sunMatchesCard(sun, UID)).toBe(true);
    expect(sunMatchesCard(sun, "04a1b2c3d4e5f6")).toBe(true);
  });
  it("flags a different card UID", () => {
    expect(sunMatchesCard(sun, "04:11:22:33:44:55:66")).toBe(false);
  });
});

describe("interpretNdefRead / sunCheckViaBridge (mocked bridge)", () => {
  it("accepts both bare-array and {records} bridge result shapes", () => {
    const record = { recordType: "url", data: SUN_URL };
    expect(interpretNdefRead([record], UID)).toEqual({
      ok: true,
      sun: parseSunFromUrl(SUN_URL),
    });
    expect(interpretNdefRead({ records: [record] }, UID)).toMatchObject({ ok: true });
  });

  it("fails unreadable when there is no NDEF / no URL / no SUN params", () => {
    expect(interpretNdefRead(null, UID)).toMatchObject({ ok: false, kind: "unreadable" });
    expect(
      interpretNdefRead([{ recordType: "text", data: "hello" }], UID),
    ).toMatchObject({ ok: false, kind: "unreadable" });
    expect(
      interpretNdefRead([{ recordType: "url", data: "https://x.test/plain" }], UID),
    ).toMatchObject({ ok: false, kind: "unreadable" });
  });

  it("fails tamper on a mirrored-UID mismatch", () => {
    const result = interpretNdefRead([{ recordType: "url", data: SUN_URL }], "04:99:99:99:99:99:99");
    expect(result).toMatchObject({ ok: false, kind: "tamper" });
  });

  it("sunCheckViaBridge resolves through a mocked bridge request", async () => {
    const request = async () => [{ recordType: "url", data: SUN_URL }];
    await expect(sunCheckViaBridge(request, UID)).resolves.toMatchObject({ ok: true });
  });

  it("sunCheckViaBridge fails closed when the bridge rejects (e.g. unsupported)", async () => {
    const request = async () => {
      throw new Error("read-ndef arrives in Phase B");
    };
    const result = await sunCheckViaBridge(request, UID);
    expect(result).toMatchObject({ ok: false, kind: "unreadable" });
    expect(result.ok === false && result.message).toContain("Phase B");
  });
});

// ── Station reducer: happy path ─────────────────────────────────────────────

describe("bridge-decoded SUN (encrypted-PICC layout)", () => {
  const encRecord = { recordType: "url", data: ENC_SUN_URL } as const;

  it("uses the bridge's decoded sun and normalizes it to SunParams", () => {
    expect(interpretNdefRead({ records: [encRecord], sun: BRIDGE_SUN }, UID)).toEqual({
      ok: true,
      sun: { uidHex: "0x04a1b2c3d4e5f6", counter: 10, cmacHex: "0x0102030405060708" },
    });
  });

  it("fails tamper when the bridge reports a CMAC mismatch — even before the UID check", () => {
    const result = interpretNdefRead(
      { records: [encRecord], sun: { ...BRIDGE_SUN, cmacVerified: false } },
      UID,
    );
    expect(result).toMatchObject({ ok: false, kind: "tamper" });
    expect((result as { message: string }).message).toMatch(/SDMMAC mismatch/);
  });

  it("fails tamper when the decoded UID is not the tapped card", () => {
    expect(
      interpretNdefRead({ records: [encRecord], sun: BRIDGE_SUN }, "04:99:99:99:99:99:99"),
    ).toMatchObject({ ok: false, kind: "tamper" });
  });

  it("is unreadable with the bridge's reason when the encrypted SUN was not decoded", () => {
    const withReason = interpretNdefRead(
      { records: [encRecord], sun: null, sunError: "chip was personalized with a different SDM master key" },
      UID,
    );
    expect(withReason).toMatchObject({ ok: false, kind: "unreadable" });
    expect((withReason as { message: string }).message).toMatch(/different SDM master key/);

    const olderBridge = interpretNdefRead([encRecord], UID);
    expect(olderBridge).toMatchObject({ ok: false, kind: "unreadable" });
    expect((olderBridge as { message: string }).message).toMatch(/Encrypted SUN URL/);
  });

  it("ignores a malformed sun object and falls back to the URL path", () => {
    expect(sunFromBridgeDecode({ uid: "04:A1", counter: 1, cmac: "0102030405060708" })).toBeNull();
    expect(sunFromBridgeDecode({ uid: UID, counter: -1, cmac: "0102030405060708" })).toBeNull();
    expect(sunFromBridgeDecode({ uid: UID, counter: 1, cmac: "01" })).toBeNull();
    expect(sunFromBridgeDecode(null)).toBeNull();
    // Plain-mirror URL still wins when the bridge attached garbage.
    expect(
      interpretNdefRead({ records: [{ recordType: "url", data: SUN_URL }], sun: { uid: 5 } }, UID),
    ).toMatchObject({ ok: true });
  });

  it("recognizes the encrypted layout only with well-formed picc + cmac", () => {
    expect(isEncryptedSunUrl(ENC_SUN_URL)).toBe(true);
    expect(isEncryptedSunUrl(SUN_URL)).toBe(false);
    expect(isEncryptedSunUrl("nope")).toBe(false);
  });
});

describe("stationReducer — bind loop", () => {
  it("LOAD → idle with a queue; empty queue → complete", () => {
    expect(loadedState().phase).toBe("idle");
    const done = stationReducer(initialStationState, {
      type: "LOAD",
      tokens: [token("1", "bound")],
    });
    expect(done.phase).toBe("complete");
  });

  it("TAP → SUN_OK → BIND_OK marks the token bound, arms lastBind, logs", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    expect(s.phase).toBe("verifying");
    s = stationReducer(s, { type: "SUN_OK" });
    expect(s.phase).toBe("binding");
    s = stationReducer(s, { type: "BIND_OK", txHash: "0xabc", at: 1_000 });
    expect(s.phase).toBe("bound");
    expect(s.lastBind).toMatchObject({
      tokenId: "2",
      serial: "SN-2",
      uid: UID,
      boundAt: 1_000,
      txHash: "0xabc",
      anchorStatus: "unknown",
    });
    expect(s.boundCount).toBe(1);
    expect(s.tokens.find((t) => t.tokenId === "2")?.lifecycle).toBe("bound");
    expect(s.sessionLog[0]).toMatchObject({ kind: "bound", tokenId: "2" });

    // ADVANCE moves to the next unbound token (SN-10 → token 3).
    s = stationReducer(s, { type: "ADVANCE" });
    expect(s.phase).toBe("idle");
    expect(currentToken(s)?.tokenId).toBe("3");
  });

  it("ADVANCE lands on complete when the queue empties", () => {
    let s = stationReducer(initialStationState, {
      type: "LOAD",
      tokens: [token("9", "minted", "SN-9")],
    });
    s = stationReducer(s, { type: "TAP", uid: UID });
    s = stationReducer(s, { type: "SUN_OK" });
    s = stationReducer(s, { type: "BIND_OK", txHash: null, at: 5 });
    s = stationReducer(s, { type: "ADVANCE" });
    expect(s.phase).toBe("complete");
    expect(currentToken(s)).toBeNull();
  });

  it("taps outside idle and double-Enter are no-ops", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    const midVerify = stationReducer(s, { type: "TAP", uid: "04:00:00:00:00:00:01" });
    expect(midVerify).toBe(s); // ignored
    expect(stationReducer(loadedState(), { type: "ADVANCE" }).phase).toBe("idle");
  });

  it("background LOAD keeps a mid-flight phase but refreshes tokens", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    const refreshed = stationReducer(s, {
      type: "LOAD",
      tokens: [token("2", "minted", "SN-2")],
    });
    expect(refreshed.phase).toBe("verifying");
    expect(refreshed.tokens).toHaveLength(1);
  });
});

// ── Station reducer: SUN-fail path (REQ-S-21) ───────────────────────────────

describe("stationReducer — SUN-fail path", () => {
  it("SUN_FAIL returns to idle with a tamper warning and NEVER reaches binding", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    s = stationReducer(s, { type: "SUN_FAIL", kind: "tamper", message: "UID mismatch", at: 2_000 });
    expect(s.phase).toBe("idle");
    expect(s.sunFail).toEqual({ kind: "tamper", message: "UID mismatch" });
    expect(s.lastBind).toBeNull();
    expect(s.boundCount).toBe(0);
    expect(s.sessionLog[0]).toMatchObject({ kind: "sun_fail", tokenId: "2" });
    // Same token stays next up for a fresh chip / skip decision.
    expect(currentToken(s)?.tokenId).toBe("2");
    // A BIND_OK arriving out-of-phase must be ignored (fail closed).
    expect(stationReducer(s, { type: "BIND_OK", txHash: null, at: 3_000 })).toBe(s);
  });

  it("SKIP_RECORDED keeps the SAME token next in queue (chip skipped, not token)", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    s = stationReducer(s, { type: "SUN_FAIL", kind: "unreadable", message: "no NDEF", at: 1 });
    s = stationReducer(s, { type: "SKIP_RECORDED", reason: "dead chip", at: 2 });
    expect(s.phase).toBe("idle");
    expect(s.sunFail).toBeNull();
    expect(currentToken(s)?.tokenId).toBe("2");
    expect(s.sessionLog[0]).toMatchObject({ kind: "skipped", detail: "dead chip" });
  });

  it("BIND_FAIL surfaces the error and returns to idle on the same token", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    s = stationReducer(s, { type: "SUN_OK" });
    s = stationReducer(s, { type: "BIND_FAIL", error: "relayer out of gas", at: 3 });
    expect(s.phase).toBe("idle");
    expect(s.bindError).toBe("relayer out of gas");
    expect(currentToken(s)?.tokenId).toBe("2");
  });
});

// ── Grace countdown gating ──────────────────────────────────────────────────

describe("grace countdown (Fix last bind gating)", () => {
  function boundState(boundAt: number): StationState {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    s = stationReducer(s, { type: "SUN_OK" });
    return stationReducer(s, { type: "BIND_OK", txHash: null, at: boundAt });
  }

  it("enabled strictly inside the 120s window, disabled at and after expiry", () => {
    const s = boundState(10_000);
    expect(graceRemainingMs(s.lastBind, 10_000)).toBe(GRACE_MS);
    expect(canFixLastBind(s, 10_000 + GRACE_MS - 1)).toBe(true);
    expect(canFixLastBind(s, 10_000 + GRACE_MS)).toBe(false);
    expect(canFixLastBind(s, 10_000 + GRACE_MS + 5_000)).toBe(false);
  });

  it("no last bind → never enabled", () => {
    expect(canFixLastBind(loadedState(), 0)).toBe(false);
  });

  it("REASSIGN_DONE consumes the grace (lastBind cleared, swap logged)", () => {
    let s = boundState(10_000);
    s = stationReducer(s, { type: "REASSIGN_DONE", targetTokenId: "3", at: 20_000 });
    expect(s.lastBind).toBeNull();
    expect(canFixLastBind(s, 20_000)).toBe(false);
    expect(s.sessionLog[0]).toMatchObject({ kind: "reassigned", tokenId: "2" });
    // Lifecycles untouched: the target still needs its own chip.
    expect(currentToken(stationReducer(s, { type: "ADVANCE" }))?.tokenId).toBe("3");
  });

  it("ANCHOR flips the last bind's anchor status (pending → confirmed)", () => {
    let s = boundState(0);
    s = stationReducer(s, { type: "ANCHOR", status: "pending" });
    expect(s.lastBind?.anchorStatus).toBe("pending");
    s = stationReducer(s, { type: "ANCHOR", status: "confirmed" });
    expect(s.lastBind?.anchorStatus).toBe("confirmed");
  });
});

// ── Void + remint ───────────────────────────────────────────────────────────

describe("stationReducer — VOID_DONE", () => {
  it("recycles the token out of the queue and clears a matching lastBind", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    s = stationReducer(s, { type: "SUN_OK" });
    s = stationReducer(s, { type: "BIND_OK", txHash: null, at: 1 });
    s = stationReducer(s, { type: "VOID_DONE", tokenId: "2", replacementTokenId: "17", at: 2 });
    expect(s.tokens.find((t) => t.tokenId === "2")?.lifecycle).toBe("recycled");
    expect(s.lastBind).toBeNull();
    expect(s.sessionLog[0]).toMatchObject({ kind: "voided", detail: "reminted as token #17" });
  });

  it("voiding the current pending token advances the queue", () => {
    let s = loadedState(); // next up: token 2 (SN-2)
    s = stationReducer(s, { type: "VOID_DONE", tokenId: "2", replacementTokenId: null, at: 1 });
    expect(currentToken(s)?.tokenId).toBe("3");
    // Voiding the LAST pending token completes the batch.
    s = stationReducer(s, { type: "VOID_DONE", tokenId: "3", replacementTokenId: null, at: 2 });
    expect(s.phase).toBe("complete");
  });

  it("ignores unknown token ids", () => {
    const s = loadedState();
    expect(stationReducer(s, { type: "VOID_DONE", tokenId: "99", replacementTokenId: null, at: 1 })).toBe(s);
  });
});

describe("BATCH_ID_RE", () => {
  it("mirrors the services batch id shape", () => {
    expect(BATCH_ID_RE.test("bat_01HZXK9")).toBe(true);
    expect(BATCH_ID_RE.test("tpl_123")).toBe(false);
    expect(BATCH_ID_RE.test("bat_")).toBe(false);
  });
});

// ── WB-01: cmacVerified surfacing ───────────────────────────────────────────

describe("cmacVerified (WB-01)", () => {
  it("SUN_OK carries the server CMAC verdict into state and the last bind", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    expect(s.cmacVerified).toBeNull(); // no server verify yet for this tap
    s = stationReducer(s, { type: "SUN_OK", cmacVerified: true });
    expect(s.cmacVerified).toBe(true);
    s = stationReducer(s, { type: "BIND_OK", txHash: null, at: 1 });
    expect(s.lastBind?.cmacVerified).toBe(true);
  });

  it("counter-only check (cmacVerified false / omitted) never reads as verified", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    s = stationReducer(s, { type: "SUN_OK" }); // legacy shape — no claim
    expect(s.cmacVerified).toBe(false);
    s = stationReducer(s, { type: "BIND_OK", txHash: null, at: 1 });
    expect(s.lastBind?.cmacVerified).toBe(false);

    let t = loadedState();
    t = stationReducer(t, { type: "TAP", uid: UID });
    t = stationReducer(t, { type: "SUN_OK", cmacVerified: false });
    expect(t.cmacVerified).toBe(false);
  });

  it("a fresh TAP resets the previous tap's CMAC verdict", () => {
    let s = loadedState();
    s = stationReducer(s, { type: "TAP", uid: UID });
    s = stationReducer(s, { type: "SUN_OK", cmacVerified: true });
    s = stationReducer(s, { type: "BIND_OK", txHash: null, at: 1 });
    s = stationReducer(s, { type: "ADVANCE" });
    s = stationReducer(s, { type: "TAP", uid: "04:00:00:00:00:00:02" });
    expect(s.cmacVerified).toBeNull();
  });
});
