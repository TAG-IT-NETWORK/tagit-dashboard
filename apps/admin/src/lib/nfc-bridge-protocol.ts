/**
 * Wire protocol for the local NFC bridge (tagit-nfc-bridge).
 *
 * MIRROR of tagit-nfc-bridge/src/protocol.ts — keep the two in sync. The bridge
 * is the source of truth; this copy lets the dashboard talk to it with shared
 * types. Also carries chip display specs used by the chip-type selector.
 */

export const PROTOCOL_VERSION = 1;

/** NTAG chip families the bridge can detect. */
export type ChipType = "NTAG213" | "NTAG215" | "NTAG216" | "NTAG424DNA" | "UNKNOWN";

export interface CardInfo {
  /** 7-byte UID, colon-separated uppercase hex, e.g. "04:A1:B2:C3:D4:E5:F6". */
  uid: string;
  chip: ChipType;
  /** Usable NDEF capacity in bytes for this chip, if known. */
  capacityBytes: number | null;
  /** ATR reported by the reader, hex. */
  atr: string;
}

export interface NdefRecordDTO {
  recordType: "url" | "text" | "unknown";
  data: string;
}

// --- Client -> Bridge requests ---------------------------------------------

interface BaseRequest {
  id: string;
}
export interface GetStatusRequest extends BaseRequest {
  type: "get-status";
}
export interface ReadUidRequest extends BaseRequest {
  type: "read-uid";
}
export interface ReadNdefRequest extends BaseRequest {
  type: "read-ndef";
}
export interface WriteNdefRequest extends BaseRequest {
  type: "write-ndef";
  records: NdefRecordDTO[];
}
export type BridgeRequest = GetStatusRequest | ReadUidRequest | ReadNdefRequest | WriteNdefRequest;

// --- Bridge -> Client messages ---------------------------------------------

export interface HelloMessage {
  type: "hello";
  protocolVersion: number;
  bridgeVersion: string;
}
export interface ReaderStatusMessage {
  type: "reader-status";
  connected: boolean;
  readerName: string | null;
}
export interface CardPresentMessage {
  type: "card-present";
  card: CardInfo;
}
export interface CardRemovedMessage {
  type: "card-removed";
}
export interface ResultMessage {
  type: "result";
  id: string;
  ok: true;
  data: unknown;
}
export type ErrorCode =
  | "no-reader"
  | "no-card"
  | "unauthorized"
  | "bad-request"
  | "unsupported"
  | "read-failed"
  | "write-failed"
  | "capacity-exceeded"
  | "internal";
export interface ErrorMessage {
  type: "error";
  id?: string;
  code: ErrorCode;
  message: string;
}
export type BridgeMessage =
  | HelloMessage
  | ReaderStatusMessage
  | CardPresentMessage
  | CardRemovedMessage
  | ResultMessage
  | ErrorMessage;

// --- Chip display specs (dashboard-only) -----------------------------------

export interface ChipSpec {
  type: ChipType;
  label: string;
  /** Usable NDEF capacity in bytes, or null if unknown. */
  capacityBytes: number | null;
  /** True for chips supporting NTAG 424 DNA secure dynamic messaging. */
  secure: boolean;
}

export const CHIP_SPECS: Record<ChipType, ChipSpec> = {
  NTAG213: { type: "NTAG213", label: "NTAG213", capacityBytes: 144, secure: false },
  NTAG215: { type: "NTAG215", label: "NTAG215", capacityBytes: 504, secure: false },
  NTAG216: { type: "NTAG216", label: "NTAG216", capacityBytes: 888, secure: false },
  NTAG424DNA: { type: "NTAG424DNA", label: "NTAG424 DNA", capacityBytes: 416, secure: true },
  UNKNOWN: { type: "UNKNOWN", label: "Unknown", capacityBytes: null, secure: false },
};

/** Chip options for the selector (UNKNOWN omitted — it's a detection state). */
export const CHIP_OPTIONS: ChipSpec[] = [
  CHIP_SPECS.NTAG213,
  CHIP_SPECS.NTAG215,
  CHIP_SPECS.NTAG216,
  CHIP_SPECS.NTAG424DNA,
];
