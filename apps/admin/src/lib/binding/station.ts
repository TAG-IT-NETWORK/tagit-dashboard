import type { NdefRecordDTO } from "@/lib/nfc-bridge-protocol";

/**
 * Pure state machine + parsers for the batch binding station (META-T35).
 * Kept free of React and fetch so queue order, SUN gating, and the grace
 * countdown can be unit tested directly (bridge mocked as a plain function).
 *
 * The station drives an assembly-line loop over one mint batch:
 *
 *   idle ("next up: token #N / serial S")
 *     → TAP        (chip lands on the ACR1252U via the local WS bridge)
 *     → verifying  (SUN read + verify FIRST — REQ-S-21: never bind on a
 *                   failed SUN; failure returns to idle with a tamper warning
 *                   and the Skip rail)
 *     → binding    (POST bind via the server relay proxy)
 *     → bound      (anchor grace armed; Enter/auto advances)
 *     → idle | complete
 *
 * Server truth: lifecycle comes from GET /admin/batches/:id — re-entering the
 * page rebuilds the queue from it, so the loop resumes at the first unbound
 * token with no client persistence.
 */

/** Mirror of tagit-services batch-router BATCH_ID_RE. */
export const BATCH_ID_RE = /^bat_[0-9A-Za-z]{1,64}$/;

/**
 * Anchor grace window, ms — mirror of the tagit-services anchor-worker delay
 * that keeps a fresh bind's anchor cancellable. "Fix last bind" (reassign) is
 * only accepted server-side while that timer is armed; the client countdown
 * seeded from bind time disables the button in step. The server remains the
 * enforcement point (409 GRACE_EXPIRED after).
 */
export const GRACE_MS = 120_000;

// ── Batch status DTO (GET /api/v1/admin/batches/:id via proxy) ──────────────

export interface StationToken {
  /** Decimal token id string (services serializes bigint → string). */
  tokenId: string;
  /** catalog_items.lifecycle: minted | bound | … | recycled. */
  lifecycle: string;
  tagUid: string | null;
  serial: string | null;
}

/** Tolerant parse of the batch-status body → station tokens (null = bad DTO). */
export function parseBatchTokens(body: unknown): StationToken[] | null {
  const progress = (body as { progress?: { tokens?: unknown } } | null)?.progress;
  if (!progress || !Array.isArray(progress.tokens)) return null;
  const tokens: StationToken[] = [];
  for (const raw of progress.tokens) {
    const t = raw as Record<string, unknown>;
    if (typeof t?.tokenId !== "string" || typeof t?.lifecycle !== "string") continue;
    tokens.push({
      tokenId: t.tokenId,
      lifecycle: t.lifecycle,
      tagUid: typeof t.tagUid === "string" ? t.tagUid : null,
      serial: typeof t.serial === "string" ? t.serial : null,
    });
  }
  return tokens;
}

/**
 * Serial order for the loop: natural-sorted serial first (SN-2 before SN-10),
 * serial-less tokens after, by numeric tokenId. Stable + deterministic — the
 * "next up" pointer must not jump between renders or reloads.
 */
export function orderBySerial(tokens: StationToken[]): StationToken[] {
  return [...tokens].sort((a, b) => {
    if (a.serial !== null && b.serial !== null) {
      const bySerial = a.serial.localeCompare(b.serial, undefined, { numeric: true });
      if (bySerial !== 0) return bySerial;
    } else if (a.serial !== null) {
      return -1;
    } else if (b.serial !== null) {
      return 1;
    }
    return compareTokenIds(a.tokenId, b.tokenId);
  });
}

function compareTokenIds(a: string, b: string): number {
  // Decimal strings — compare by length then lexically (avoids BigInt in hot paths).
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Unbound (still MINTED) tokens in serial order — the station queue. */
export function pendingQueue(tokens: StationToken[]): StationToken[] {
  return orderBySerial(tokens.filter((t) => t.lifecycle === "minted"));
}

// ── SUN (NTAG 424 DNA Secure Unique NFC message) ────────────────────────────

export interface SunParams {
  /** 0x-prefixed lowercase 7-byte UID hex, e.g. "0x04a1b2c3d4e5f6". */
  uidHex: `0x${string}`;
  /** SDM read counter (the ASCII mirror is hex-encoded per NXP AN12196). */
  counter: number;
  /** 0x-prefixed lowercase 8-byte SDM MAC hex. */
  cmacHex: `0x${string}`;
}

const SUN_UID_KEYS = ["uid", "u"] as const;
const SUN_CTR_KEYS = ["ctr", "counter", "c"] as const;
const SUN_CMAC_KEYS = ["cmac", "mac", "m"] as const;

function firstParam(params: URLSearchParams, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value.length > 0) return value;
  }
  return null;
}

/**
 * Parse SDM mirror params out of a SUN URL. Accepts the plain-mirror layout
 * the bridge personalizes (uid/ctr/cmac query params, hex-encoded ASCII
 * mirrors). Encrypted PICC-data layouts are not parseable client-side and
 * return null — the station treats that as an unverifiable chip.
 */
export function parseSunFromUrl(url: string): SunParams | null {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return null;
  }
  const uid = firstParam(params, SUN_UID_KEYS);
  const ctr = firstParam(params, SUN_CTR_KEYS);
  const cmac = firstParam(params, SUN_CMAC_KEYS);
  if (!uid || !ctr || !cmac) return null;
  if (!/^[0-9a-fA-F]{14}$/.test(uid)) return null;
  if (!/^[0-9a-fA-F]{1,8}$/.test(ctr)) return null;
  if (!/^[0-9a-fA-F]{16}$/.test(cmac)) return null;
  return {
    uidHex: `0x${uid.toLowerCase()}` as `0x${string}`,
    counter: parseInt(ctr, 16),
    cmacHex: `0x${cmac.toLowerCase()}` as `0x${string}`,
  };
}

/** True when the SUN-mirrored UID matches the tapped card's colon-hex UID. */
export function sunMatchesCard(sun: SunParams, cardUid: string): boolean {
  const card = cardUid.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  return card.length > 0 && sun.uidHex === `0x${card}`;
}

export type SunFailKind =
  /** SUN present but wrong — mirrored UID mismatch or server verify failure. */
  | "tamper"
  /** Chip unverifiable — no NDEF/SUN payload, or the bridge cannot read it. */
  | "unreadable";

export type TapEvaluation =
  | { ok: true; sun: SunParams }
  | { ok: false; kind: SunFailKind; message: string };

/**
 * Interpret a bridge read-ndef result for the tapped card. Pure — the bridge
 * response rides in as plain data. Accepts both `NdefRecordDTO[]` and
 * `{records: NdefRecordDTO[]}` result shapes.
 */
export function interpretNdefRead(result: unknown, cardUid: string): TapEvaluation {
  const records: unknown = Array.isArray(result)
    ? result
    : (result as { records?: unknown } | null)?.records;
  if (!Array.isArray(records) || records.length === 0) {
    return { ok: false, kind: "unreadable", message: "Chip has no readable NDEF message" };
  }
  const urls = (records as NdefRecordDTO[]).filter(
    (r) => r && r.recordType === "url" && typeof r.data === "string",
  );
  if (urls.length === 0) {
    return { ok: false, kind: "unreadable", message: "Chip carries no URL record (not SDM-personalized?)" };
  }
  for (const record of urls) {
    const sun = parseSunFromUrl(record.data);
    if (sun) {
      if (!sunMatchesCard(sun, cardUid)) {
        return {
          ok: false,
          kind: "tamper",
          message: "SUN UID mismatch — the chip's mirrored UID does not match the tapped card",
        };
      }
      return { ok: true, sun };
    }
  }
  return {
    ok: false,
    kind: "unreadable",
    message: "URL record carries no parseable SUN params (uid/ctr/cmac)",
  };
}

/**
 * Read the tapped chip's SUN message through the WS bridge. `request` is the
 * bridge RPC (mock it in tests); bridge errors — including an older bridge
 * answering read-ndef with "unsupported" — degrade to an unverifiable-chip
 * failure, never a bind (REQ-S-21 fail-closed).
 */
export async function sunCheckViaBridge(
  request: (req: { type: "read-ndef" }) => Promise<unknown>,
  cardUid: string,
): Promise<TapEvaluation> {
  let result: unknown;
  try {
    result = await request({ type: "read-ndef" });
  } catch (err) {
    return {
      ok: false,
      kind: "unreadable",
      message: `Bridge could not read the chip: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return interpretNdefRead(result, cardUid);
}

// ── Station reducer ─────────────────────────────────────────────────────────

export type StationPhase = "loading" | "idle" | "verifying" | "binding" | "bound" | "complete";

export type AnchorStatus = "unknown" | "pending" | "confirmed" | "failed";

export interface LastBind {
  tokenId: string;
  serial: string | null;
  uid: string;
  /** Client clock at bind confirm — seeds the 120s grace countdown. */
  boundAt: number;
  txHash: string | null;
  anchorStatus: AnchorStatus;
}

export type LogKind = "bound" | "sun_fail" | "bind_fail" | "skipped" | "reassigned" | "voided";

export interface LogEntry {
  at: number;
  kind: LogKind;
  tokenId: string;
  serial: string | null;
  /** Operator/system free text — must always be rendered inert (text node). */
  detail: string;
}

export interface StationState {
  /** Full batch tokens (all lifecycles); the queue derives via pendingQueue. */
  tokens: StationToken[];
  phase: StationPhase;
  /** UID of the chip currently being verified/bound. */
  tapUid: string | null;
  sunFail: { kind: SunFailKind; message: string } | null;
  bindError: string | null;
  lastBind: LastBind | null;
  sessionLog: LogEntry[];
  /** Binds confirmed in this browser session. */
  boundCount: number;
}

export const initialStationState: StationState = {
  tokens: [],
  phase: "loading",
  tapUid: null,
  sunFail: null,
  bindError: null,
  lastBind: null,
  sessionLog: [],
  boundCount: 0,
};

export type StationAction =
  | { type: "LOAD"; tokens: StationToken[] }
  | { type: "LOAD_FAILED" }
  | { type: "TAP"; uid: string }
  | { type: "SUN_OK" }
  | { type: "SUN_FAIL"; kind: SunFailKind; message: string; at: number }
  | { type: "BIND_OK"; txHash: string | null; at: number }
  | { type: "BIND_FAIL"; error: string; at: number }
  | { type: "ADVANCE" }
  | { type: "SKIP_RECORDED"; reason: string; at: number }
  | { type: "REASSIGN_DONE"; targetTokenId: string; at: number }
  | { type: "VOID_DONE"; tokenId: string; replacementTokenId: string | null; at: number }
  | { type: "ANCHOR"; status: AnchorStatus }
  | { type: "DISMISS_WARNING" };

/** The "next up" token — head of the unbound queue (null when complete). */
export function currentToken(state: StationState): StationToken | null {
  return pendingQueue(state.tokens)[0] ?? null;
}

/** Milliseconds of anchor grace left for the last bind (0 when expired/none). */
export function graceRemainingMs(lastBind: LastBind | null, now: number): number {
  if (!lastBind) return 0;
  return Math.max(0, lastBind.boundAt + GRACE_MS - now);
}

/** "Fix last bind" is enabled ONLY while the anchor grace countdown runs. */
export function canFixLastBind(state: StationState, now: number): boolean {
  return graceRemainingMs(state.lastBind, now) > 0;
}

function log(state: StationState, entry: LogEntry): LogEntry[] {
  return [entry, ...state.sessionLog];
}

function phaseForQueue(tokens: StationToken[]): StationPhase {
  return pendingQueue(tokens).length === 0 ? "complete" : "idle";
}

function markLifecycle(tokens: StationToken[], tokenId: string, lifecycle: string): StationToken[] {
  return tokens.map((t) => (t.tokenId === tokenId ? { ...t, lifecycle } : t));
}

/**
 * Station transitions. Invalid-phase actions are no-ops (taps while binding,
 * double Enter, …) so a chatty bridge can never corrupt the loop.
 */
export function stationReducer(state: StationState, action: StationAction): StationState {
  switch (action.type) {
    case "LOAD": {
      // Server truth wins: rebuild the queue, keep this session's log/lastBind.
      // Mid-flight phases survive a background refresh untouched.
      const busy = state.phase === "verifying" || state.phase === "binding" || state.phase === "bound";
      return {
        ...state,
        tokens: action.tokens,
        phase: busy ? state.phase : phaseForQueue(action.tokens),
      };
    }
    case "LOAD_FAILED":
      return state.phase === "loading" ? { ...state, phase: "idle" } : state;
    case "TAP": {
      if (state.phase !== "idle" || currentToken(state) === null) return state;
      return { ...state, phase: "verifying", tapUid: action.uid, sunFail: null, bindError: null };
    }
    case "SUN_OK":
      if (state.phase !== "verifying") return state;
      return { ...state, phase: "binding" };
    case "SUN_FAIL": {
      if (state.phase !== "verifying") return state;
      const token = currentToken(state);
      return {
        ...state,
        phase: "idle",
        sunFail: { kind: action.kind, message: action.message },
        sessionLog: token
          ? log(state, {
              at: action.at,
              kind: "sun_fail",
              tokenId: token.tokenId,
              serial: token.serial,
              detail: `${state.tapUid ?? "?"}: ${action.message}`,
            })
          : state.sessionLog,
      };
    }
    case "BIND_OK": {
      if (state.phase !== "binding") return state;
      const token = currentToken(state);
      if (!token) return { ...state, phase: "complete" };
      const tokens = markLifecycle(state.tokens, token.tokenId, "bound");
      return {
        ...state,
        tokens,
        phase: "bound",
        lastBind: {
          tokenId: token.tokenId,
          serial: token.serial,
          uid: state.tapUid ?? "",
          boundAt: action.at,
          txHash: action.txHash,
          anchorStatus: "unknown",
        },
        boundCount: state.boundCount + 1,
        sessionLog: log(state, {
          at: action.at,
          kind: "bound",
          tokenId: token.tokenId,
          serial: token.serial,
          detail: state.tapUid ?? "",
        }),
      };
    }
    case "BIND_FAIL": {
      if (state.phase !== "binding") return state;
      const token = currentToken(state);
      return {
        ...state,
        phase: "idle",
        bindError: action.error,
        sessionLog: token
          ? log(state, {
              at: action.at,
              kind: "bind_fail",
              tokenId: token.tokenId,
              serial: token.serial,
              detail: action.error,
            })
          : state.sessionLog,
      };
    }
    case "ADVANCE":
      if (state.phase !== "bound") return state;
      return { ...state, phase: phaseForQueue(state.tokens), tapUid: null };
    case "SKIP_RECORDED": {
      // Chip skipped, NOT the token — services keeps it MINTED and next-in-
      // queue; the operator reaches for a fresh chip for the same token.
      const token = currentToken(state);
      if (!token) return state;
      return {
        ...state,
        phase: state.phase === "verifying" || state.phase === "idle" ? "idle" : state.phase,
        tapUid: null,
        sunFail: null,
        bindError: null,
        sessionLog: log(state, {
          at: action.at,
          kind: "skipped",
          tokenId: token.tokenId,
          serial: token.serial,
          detail: action.reason,
        }),
      };
    }
    case "REASSIGN_DONE": {
      if (!state.lastBind) return state;
      // Content swapped between lastBind.tokenId and the target; lifecycles are
      // untouched (the target still needs its own chip). The grace was consumed
      // by the swap — a second fix on the same bind is not offered.
      return {
        ...state,
        lastBind: null,
        sessionLog: log(state, {
          at: action.at,
          kind: "reassigned",
          tokenId: state.lastBind.tokenId,
          serial: state.lastBind.serial,
          detail: `content swapped with token #${action.targetTokenId}`,
        }),
      };
    }
    case "VOID_DONE": {
      const voided = state.tokens.find((t) => t.tokenId === action.tokenId);
      if (!voided) return state;
      const tokens = markLifecycle(state.tokens, action.tokenId, "recycled");
      const clearsLastBind = state.lastBind?.tokenId === action.tokenId;
      return {
        ...state,
        tokens,
        phase:
          state.phase === "verifying" || state.phase === "binding"
            ? state.phase
            : phaseForQueue(tokens),
        lastBind: clearsLastBind ? null : state.lastBind,
        sessionLog: log(state, {
          at: action.at,
          kind: "voided",
          tokenId: action.tokenId,
          serial: voided.serial,
          detail: action.replacementTokenId
            ? `reminted as token #${action.replacementTokenId}`
            : "remint pending",
        }),
      };
    }
    case "ANCHOR":
      if (!state.lastBind || state.lastBind.anchorStatus === action.status) return state;
      return { ...state, lastBind: { ...state.lastBind, anchorStatus: action.status } };
    case "DISMISS_WARNING":
      return { ...state, sunFail: null, bindError: null };
    default:
      return state;
  }
}
