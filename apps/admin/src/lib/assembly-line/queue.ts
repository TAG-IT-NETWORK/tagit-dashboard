import type { ChipType } from "@/lib/nfc-bridge-protocol";
import { uidToTagId } from "@/lib/tag-utils";

/**
 * Pure state/reducer for the Assembly Line bulk chip-programming queue.
 * Kept free of React/wagmi so dedupe/cap/status transitions can be unit
 * tested directly (no rendering, no bridge mocks).
 */

/** Mirrors TAGITCore.MAX_BATCH_SIZE — batchMint/batchBind/batchActivate cap out here. */
export const MAX_QUEUE_SIZE = 100;

export type SdmStatus =
  /** Chip type doesn't support SDM, or "program on tap" is off — queued UID-only. */
  | "skipped"
  /** personalize-sdm request in flight. */
  | "pending"
  /** personalize-sdm succeeded. */
  | "success"
  /** personalize-sdm failed — item stays queued, retry available. */
  | "error";

export interface QueueItem {
  /** Colon-separated hex UID, e.g. "04:A1:B2:C3:D4:E5:F6" — the dedupe key. */
  uid: string;
  chip: ChipType;
  /** keccak256(uid) — precomputed at add-time for the bind step + preview. */
  tagId: `0x${string}`;
  sdmStatus: SdmStatus;
  sdmError?: string;
}

export type QueueEvent =
  | { type: "duplicate"; uid: string; position: number }
  | { type: "full"; uid: string };

export interface QueueState {
  items: QueueItem[];
  /** Last non-fatal event from an ADD attempt, for transient UI feedback (e.g. a
   *  "duplicate — already #N in queue" flash). Cleared by any successful ADD. */
  lastEvent: QueueEvent | null;
}

export const initialQueueState: QueueState = { items: [], lastEvent: null };

export type QueueAction =
  | { type: "ADD"; uid: string; chip: ChipType; sdmStatus: SdmStatus }
  | { type: "REMOVE"; uid: string }
  | { type: "SET_SDM_STATUS"; uid: string; status: SdmStatus; error?: string }
  | { type: "CLEAR" };

/**
 * Reducer driving the queue: dedupe by UID, cap at MAX_QUEUE_SIZE, and track
 * per-item SDM personalization status. Duplicate/full attempts don't mutate
 * `items` — they surface as `lastEvent` for the caller to render a toast/flash.
 */
export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case "ADD": {
      const existingIndex = state.items.findIndex((item) => item.uid === action.uid);
      if (existingIndex !== -1) {
        return {
          ...state,
          lastEvent: { type: "duplicate", uid: action.uid, position: existingIndex + 1 },
        };
      }
      if (state.items.length >= MAX_QUEUE_SIZE) {
        return { ...state, lastEvent: { type: "full", uid: action.uid } };
      }
      const item: QueueItem = {
        uid: action.uid,
        chip: action.chip,
        tagId: uidToTagId(action.uid),
        sdmStatus: action.sdmStatus,
      };
      return { items: [...state.items, item], lastEvent: null };
    }
    case "REMOVE":
      return { ...state, items: state.items.filter((item) => item.uid !== action.uid) };
    case "SET_SDM_STATUS":
      return {
        ...state,
        items: state.items.map((item) =>
          item.uid === action.uid
            ? { ...item, sdmStatus: action.status, sdmError: action.error }
            : item,
        ),
      };
    case "CLEAR":
      return initialQueueState;
    default:
      return state;
  }
}
