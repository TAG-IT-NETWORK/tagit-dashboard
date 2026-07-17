import { describe, it, expect } from "vitest";
import { queueReducer, initialQueueState, MAX_QUEUE_SIZE, type QueueState } from "../queue";
import { uidToTagId } from "@/lib/tag-utils";

const UID_A = "04:A1:B2:C3:D4:E5:F6";
const UID_B = "04:11:22:33:44:55:66";

describe("queueReducer — ADD", () => {
  it("adds a new item with a precomputed tagId", () => {
    const state = queueReducer(initialQueueState, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "pending",
    });
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toEqual({
      uid: UID_A,
      chip: "NTAG424DNA",
      tagId: uidToTagId(UID_A),
      sdmStatus: "pending",
    });
    expect(state.lastEvent).toBeNull();
  });

  it("dedupes by UID — does not add a second item, flags the duplicate + its position", () => {
    let state = queueReducer(initialQueueState, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "skipped",
    });
    state = queueReducer(state, {
      type: "ADD",
      uid: UID_B,
      chip: "NTAG213",
      sdmStatus: "skipped",
    });
    const beforeLength = state.items.length;

    state = queueReducer(state, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "skipped",
    });

    expect(state.items).toHaveLength(beforeLength);
    expect(state.lastEvent).toEqual({ type: "duplicate", uid: UID_A, position: 1 });
  });

  it("caps at MAX_QUEUE_SIZE (100) — refuses to add past the cap", () => {
    let state: QueueState = initialQueueState;
    for (let i = 0; i < MAX_QUEUE_SIZE; i++) {
      state = queueReducer(state, {
        type: "ADD",
        uid: `04:00:00:00:00:00:${i.toString(16).padStart(2, "0")}`,
        chip: "NTAG424DNA",
        sdmStatus: "skipped",
      });
    }
    expect(state.items).toHaveLength(MAX_QUEUE_SIZE);
    expect(state.lastEvent).toBeNull();

    const overflowUid = "04:FF:FF:FF:FF:FF:FF";
    state = queueReducer(state, {
      type: "ADD",
      uid: overflowUid,
      chip: "NTAG424DNA",
      sdmStatus: "skipped",
    });

    expect(state.items).toHaveLength(MAX_QUEUE_SIZE);
    expect(state.lastEvent).toEqual({ type: "full", uid: overflowUid });
  });

  it("clears lastEvent on a successful add after a prior duplicate/full event", () => {
    let state = queueReducer(initialQueueState, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "skipped",
    });
    state = queueReducer(state, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "skipped",
    });
    expect(state.lastEvent).not.toBeNull();

    state = queueReducer(state, {
      type: "ADD",
      uid: UID_B,
      chip: "NTAG213",
      sdmStatus: "skipped",
    });
    expect(state.lastEvent).toBeNull();
    expect(state.items).toHaveLength(2);
  });
});

describe("queueReducer — REMOVE", () => {
  it("removes an item by uid", () => {
    let state = queueReducer(initialQueueState, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "skipped",
    });
    state = queueReducer(state, {
      type: "ADD",
      uid: UID_B,
      chip: "NTAG213",
      sdmStatus: "skipped",
    });
    state = queueReducer(state, { type: "REMOVE", uid: UID_A });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].uid).toBe(UID_B);
  });

  it("is a no-op for an unknown uid", () => {
    const state = queueReducer(initialQueueState, { type: "REMOVE", uid: "not-in-queue" });
    expect(state.items).toEqual([]);
  });

  it("allows re-adding a UID after it has been removed", () => {
    let state = queueReducer(initialQueueState, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "skipped",
    });
    state = queueReducer(state, { type: "REMOVE", uid: UID_A });
    state = queueReducer(state, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "skipped",
    });
    expect(state.items).toHaveLength(1);
    expect(state.lastEvent).toBeNull();
  });
});

describe("queueReducer — SET_SDM_STATUS", () => {
  it("updates sdmStatus and sdmError for the matching item only", () => {
    let state = queueReducer(initialQueueState, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "pending",
    });
    state = queueReducer(state, {
      type: "ADD",
      uid: UID_B,
      chip: "NTAG424DNA",
      sdmStatus: "pending",
    });

    state = queueReducer(state, {
      type: "SET_SDM_STATUS",
      uid: UID_A,
      status: "error",
      error: "timed out",
    });

    const itemA = state.items.find((item) => item.uid === UID_A);
    const itemB = state.items.find((item) => item.uid === UID_B);
    expect(itemA?.sdmStatus).toBe("error");
    expect(itemA?.sdmError).toBe("timed out");
    expect(itemB?.sdmStatus).toBe("pending");
    expect(itemB?.sdmError).toBeUndefined();
  });

  it("can transition an errored item back to success on retry", () => {
    let state = queueReducer(initialQueueState, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "error",
    });
    state = queueReducer(state, { type: "SET_SDM_STATUS", uid: UID_A, status: "success" });
    expect(state.items[0].sdmStatus).toBe("success");
    expect(state.items[0].sdmError).toBeUndefined();
  });
});

describe("queueReducer — CLEAR", () => {
  it("resets to the initial empty state", () => {
    let state = queueReducer(initialQueueState, {
      type: "ADD",
      uid: UID_A,
      chip: "NTAG424DNA",
      sdmStatus: "skipped",
    });
    state = queueReducer(state, { type: "CLEAR" });
    expect(state).toEqual(initialQueueState);
  });
});
