import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The chain reads, replaced by functions the test controls.
const chain = vi.hoisted(() => ({
  getTokenByTag: vi.fn(),
  getAsset: vi.fn(),
  getMetadataHash: vi.fn(),
}));
vi.mock("../contract.server", () => chain);

// The one-time link store. Unless a test says otherwise every link is fresh.
const store = vi.hoisted(() => ({ openTapLink: vi.fn() }));
vi.mock("../tap-link", () => store);

import { mintSunUrl } from "../sdm";
import { startTapRun, TICK_GRACE_MS, TICK_SEEN_AFTER_MS } from "../tap-run";

/** A test-only tag key (sequential bytes). Never a real tag key. */
const TEST_TAG_KEY_HEX = "000102030405060708090a0b0c0d0e0f";
const UID = "04A1B2C3D4E5F6";
const TOKEN_ID = 58n;
const ASSET = {
  owner: "0x00000000000000000000000000000000000000A1",
  timestamp: 1_760_000_000n,
  state: 4,
  flags: 0,
  reserved: 0,
};

function mintTap() {
  const url = new URL(
    mintSunUrl(
      "https://verify.example/sun",
      Buffer.from(TEST_TAG_KEY_HEX, "hex"),
      Buffer.from(UID, "hex"),
      7,
    ),
  );
  return { picc: url.searchParams.get("picc")!, cmac: url.searchParams.get("cmac")! };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let every already-queued promise callback run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A clock and a `wait` the test drives by hand. */
function handClock() {
  let t = 1_000;
  const waits: { ms: number; release: () => void }[] = [];
  return {
    clock: {
      now: () => t,
      wait: (ms: number) =>
        new Promise<void>((resolve) => {
          waits.push({ ms, release: resolve });
        }),
    },
    advance: (ms: number) => void (t += ms),
    waits,
  };
}

/** Whether a promise has settled yet, without waiting for it. */
async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol("pending");
  return (await Promise.race([promise, Promise.resolve(pending)])) !== pending;
}

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.SDM_MASTER_KEY;
  process.env.SDM_MASTER_KEY = TEST_TAG_KEY_HEX;
  chain.getTokenByTag.mockReset().mockResolvedValue(TOKEN_ID);
  chain.getAsset.mockReset().mockResolvedValue(ASSET);
  chain.getMetadataHash.mockReset().mockResolvedValue(null);
  store.openTapLink.mockReset().mockResolvedValue({ kind: "fresh" });
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.SDM_MASTER_KEY;
  else process.env.SDM_MASTER_KEY = savedKey;
});

describe("startTapRun (TAP-T07)", () => {
  it("returns at once, already knowing whether the tag passed its check", async () => {
    chain.getTokenByTag.mockReturnValue(new Promise(() => {})); // the chain never answers
    const { picc, cmac } = mintTap();

    const run = startTapRun(picc, cmac, () => "lookup");

    // Nothing was awaited, yet step 1 ("Reading the tag") is already settled.
    expect(run.tagRead).toBe(true);
    expect(await isSettled(run.resolution)).toBe(false);
  });

  it("does not claim the tag was read when it fails its check", async () => {
    const { picc, cmac } = mintTap();
    const tampered = cmac.slice(0, -1) + (cmac.endsWith("0") ? "1" : "0");

    const run = startTapRun(picc, tampered, () => "lookup");

    expect(run.tagRead).toBe(false);
    expect((await run.resolution).kind).toBe("counterfeit");
    expect(await run.confirmed).toBe(false);
    expect(await run.secondTick).toBe(false);
    expect(run.stepsSeen()).toBe(0);
    expect(chain.getTokenByTag).not.toHaveBeenCalled();
  });

  it("starts the page's lookup the moment the item is known, before the item reads answer", async () => {
    const asset = deferred<typeof ASSET>();
    chain.getAsset.mockReturnValue(asset.promise);
    const onItem = vi.fn((tokenId: string) => `record for ${tokenId}`);
    const { picc, cmac } = mintTap();

    const run = startTapRun(picc, cmac, onItem);
    expect(run.item()).toBeUndefined();
    await settle();

    expect(onItem).toHaveBeenCalledExactlyOnceWith("58", run.timer);
    expect(run.item()).toBe("record for 58");
    expect(await isSettled(run.confirmed)).toBe(false); // the item reads are still out

    asset.resolve(ASSET);
    expect(await run.confirmed).toBe(true);
  });

  it("confirms only when the chain answers with an item", async () => {
    const { picc, cmac } = mintTap();

    chain.getTokenByTag.mockResolvedValueOnce(0n); // a genuine tag with no item
    const unbound = startTapRun(picc, cmac, () => "lookup");
    expect((await unbound.resolution).kind).toBe("authentic-unbound");
    expect(await unbound.confirmed).toBe(false);
    expect(await unbound.secondTick).toBe(false);

    chain.getAsset.mockRejectedValueOnce(new Error("rpc down"));
    const failed = startTapRun(picc, cmac, () => "lookup");
    expect((await failed.resolution).kind).toBe("lookup-failed");
    expect(await failed.confirmed).toBe(false);
  });

  it("holds the second tick back by the grace period, and never ticks without an item", async () => {
    const hand = handClock();
    const { picc, cmac } = mintTap();

    const run = startTapRun(picc, cmac, () => "lookup", hand.clock);
    expect(await run.confirmed).toBe(true);
    await settle();

    // The chain has answered, but the tick is not released yet.
    expect(hand.waits.map((w) => w.ms)).toEqual([TICK_GRACE_MS]);
    expect(await isSettled(run.secondTick)).toBe(false);

    hand.waits[0]!.release();
    expect(await run.secondTick).toBe(true);

    chain.getTokenByTag.mockResolvedValueOnce(0n);
    const unbound = startTapRun(picc, cmac, () => "lookup", hand.clock);
    expect(await unbound.secondTick).toBe(false);
    expect(hand.waits).toHaveLength(1); // no second wait was started
  });

  it("counts a tick as seen only once it has been on screen for a moment", async () => {
    const hand = handClock();
    const asset = deferred<typeof ASSET>();
    chain.getAsset.mockReturnValue(asset.promise);
    const { picc, cmac } = mintTap();

    const run = startTapRun(picc, cmac, () => "lookup", hand.clock);
    expect(run.stepsSeen()).toBe(1); // "Reading the tag" arrives ticked

    hand.advance(5_000); // however long the chain takes, step 2 is not done yet
    expect(run.stepsSeen()).toBe(1);

    asset.resolve(ASSET);
    await run.confirmed;
    hand.advance(TICK_GRACE_MS + TICK_SEEN_AFTER_MS - 1);
    expect(run.stepsSeen()).toBe(1); // sent, but not on screen long enough
    hand.advance(1);
    expect(run.stepsSeen()).toBe(2);
  });

  it("never rejects on its progress promises, even when the run itself fails", async () => {
    const { picc, cmac } = mintTap();

    const run = startTapRun(picc, cmac, () => {
      throw new Error("lookup could not start");
    });

    await expect(run.resolution).rejects.toThrow("lookup could not start");
    expect(await run.confirmed).toBe(false);
    expect(await run.secondTick).toBe(false);
  });

  it("times the run's steps on its own timer", async () => {
    const { picc, cmac } = mintTap();

    const run = startTapRun(picc, cmac, () => "lookup");
    await run.resolution;

    expect(Object.keys(run.timer.spans()).sort()).toEqual(["chain", "link", "sdm", "tag", "total"]);
  });
});

describe("startTapRun — one-time links (TAP-T10)", () => {
  it("hands the requesting device to the check, and none when it is given none", async () => {
    const { picc, cmac } = mintTap();

    await startTapRun(picc, cmac, () => "lookup", { device: "d".repeat(64) }).resolution;
    await startTapRun(picc, cmac, () => "lookup").resolution;

    expect(store.openTapLink.mock.calls.map(([request]) => request.device)).toEqual([
      "d".repeat(64),
      null,
    ]);
  });

  it("does not start the page's lookup before the link is known to be good", async () => {
    const opening = deferred<{ kind: "fresh" }>();
    store.openTapLink.mockReturnValue(opening.promise);
    const onItem = vi.fn(() => "lookup");
    const { picc, cmac } = mintTap();

    const run = startTapRun(picc, cmac, onItem);
    await settle();
    expect(onItem).not.toHaveBeenCalled(); // the store has not answered yet

    opening.resolve({ kind: "fresh" });
    await run.resolution;
    expect(onItem).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a used link", { kind: "used" }, "link-used"],
    ["a link that could not be checked", { kind: "unavailable" }, "link-unchecked"],
  ])("%s: no lookup, nothing confirmed, no second tick", async (_name, answer, kind) => {
    store.openTapLink.mockResolvedValue(answer);
    const hand = handClock();
    const onItem = vi.fn(() => "lookup");
    const { picc, cmac } = mintTap();

    const run = startTapRun(picc, cmac, onItem, hand.clock);

    expect(run.tagRead).toBe(true); // the tag itself is real
    expect((await run.resolution).kind).toBe(kind);
    expect(await run.confirmed).toBe(false);
    expect(await run.secondTick).toBe(false);
    expect(hand.waits).toHaveLength(0);
    expect(onItem).not.toHaveBeenCalled();
    expect(run.item()).toBeUndefined();
    expect(run.stepsSeen()).toBe(1);
  });

  it("the same phone coming back runs like a first look", async () => {
    store.openTapLink.mockResolvedValue({ kind: "again", secondsAgo: 40 });
    const onItem = vi.fn(() => "lookup");
    const { picc, cmac } = mintTap();

    const run = startTapRun(picc, cmac, onItem);

    expect(await run.resolution).toMatchObject({
      kind: "resolved",
      link: { kind: "again", secondsAgo: 40 },
    });
    expect(await run.confirmed).toBe(true);
    expect(onItem).toHaveBeenCalledTimes(1);
  });
});
