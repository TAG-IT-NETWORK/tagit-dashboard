import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The chain reads, replaced by functions the test controls and counts.
const chain = vi.hoisted(() => ({
  getTokenByTag: vi.fn(),
  getAsset: vi.fn(),
  getMetadataHash: vi.fn(),
}));
vi.mock("../contract.server", () => chain);

// The one-time link store, replaced the same way. Unless a test says otherwise
// every link is being opened for the first time.
const store = vi.hoisted(() => ({ openTapLink: vi.fn() }));
vi.mock("../tap-link", () => store);

import { uidToTagHash } from "../contract";
import { resolveTap } from "../resolve";
import { mintSunUrl } from "../sdm";
import type { TapLinkUse } from "../tap-link";
import { createTapTimer } from "../tap-timing";

/** A test-only tag key (sequential bytes). Never a real tag key. */
const TEST_TAG_KEY_HEX = "000102030405060708090a0b0c0d0e0f";
const UID = "04A1B2C3D4E5F6";
const COUNTER = 42;
const TOKEN_ID = 58n;
const ASSET = {
  owner: "0x00000000000000000000000000000000000000A1",
  timestamp: 1_760_000_000n,
  state: 4,
  flags: 0,
  reserved: 0,
};
const RECORD_HASH = `0x${"ab".repeat(32)}` as const;
const DEVICE = "d".repeat(64);
const FRESH: TapLinkUse = { kind: "fresh" };

/** A valid tap for UID under the test key, as { picc, cmac }. */
function mintTap(counter = COUNTER) {
  const url = new URL(
    mintSunUrl(
      "https://verify.example/sun",
      Buffer.from(TEST_TAG_KEY_HEX, "hex"),
      Buffer.from(UID, "hex"),
      counter,
    ),
  );
  return { picc: url.searchParams.get("picc")!, cmac: url.searchParams.get("cmac")! };
}

/** A promise the test settles by hand. */
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

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.SDM_MASTER_KEY;
  process.env.SDM_MASTER_KEY = TEST_TAG_KEY_HEX;
  chain.getTokenByTag.mockReset().mockResolvedValue(TOKEN_ID);
  chain.getAsset.mockReset().mockResolvedValue(ASSET);
  chain.getMetadataHash.mockReset().mockResolvedValue(RECORD_HASH);
  store.openTapLink.mockReset().mockResolvedValue(FRESH);
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.SDM_MASTER_KEY;
  else process.env.SDM_MASTER_KEY = savedKey;
});

const chainCalls = () =>
  chain.getTokenByTag.mock.calls.length +
  chain.getAsset.mock.calls.length +
  chain.getMetadataHash.mock.calls.length;

describe("resolveTap — what it asks the chain, and when (TAP-T06)", () => {
  it("waits for the chain twice: the tag lookup, then item state and record hash together", async () => {
    const order: string[] = [];
    const token = deferred<bigint>();
    const asset = deferred<typeof ASSET>();
    const hash = deferred<`0x${string}` | null>();
    chain.getTokenByTag.mockImplementation(() => {
      order.push("tag:asked");
      return token.promise;
    });
    chain.getAsset.mockImplementation(() => {
      order.push("state:asked");
      return asset.promise.finally(() => order.push("state:answered"));
    });
    chain.getMetadataHash.mockImplementation(() => {
      order.push("hash:asked");
      return hash.promise.finally(() => order.push("hash:answered"));
    });
    const { picc, cmac } = mintTap();

    const pending = resolveTap(picc, cmac, { onTokenId: () => order.push("item known") });
    await settle();

    // First wait: only the tag lookup is out.
    expect(order).toEqual(["tag:asked"]);
    expect(chain.getTokenByTag).toHaveBeenCalledExactlyOnceWith(uidToTagHash(UID));

    token.resolve(TOKEN_ID);
    await settle();

    // Second wait: both item reads are out before either has answered, and the
    // caller was told the item number — so its own lookup overlaps them.
    expect(order).toEqual(["tag:asked", "state:asked", "hash:asked", "item known"]);
    expect(chain.getAsset).toHaveBeenCalledExactlyOnceWith(TOKEN_ID);
    expect(chain.getMetadataHash).toHaveBeenCalledExactlyOnceWith(TOKEN_ID);

    asset.resolve(ASSET);
    hash.resolve(RECORD_HASH);

    await expect(pending).resolves.toEqual({
      kind: "resolved",
      uid: UID,
      counter: COUNTER,
      tokenId: TOKEN_ID,
      asset: ASSET,
      metadataHash: RECORD_HASH,
      link: { kind: "fresh" },
    });
    expect(chainCalls()).toBe(3);
  });

  it("never reaches the chain without both parameters, a key, or a tap that passes the tag check", async () => {
    const { picc, cmac } = mintTap();

    expect(await resolveTap(undefined, cmac)).toEqual({ kind: "bad-params" });
    expect(await resolveTap(picc, undefined)).toEqual({ kind: "bad-params" });

    const tampered = cmac.slice(0, -1) + (cmac.endsWith("0") ? "1" : "0");
    expect((await resolveTap(picc, tampered)).kind).toBe("counterfeit");

    delete process.env.SDM_MASTER_KEY;
    expect(await resolveTap(picc, cmac)).toEqual({ kind: "not-configured" });

    expect(chainCalls()).toBe(0);
  });

  it("stops after the tag lookup when the tag is not linked to an item", async () => {
    chain.getTokenByTag.mockResolvedValue(0n);
    const onTokenId = vi.fn();
    const { picc, cmac } = mintTap();

    expect(await resolveTap(picc, cmac, { onTokenId })).toEqual({
      kind: "authentic-unbound",
      uid: UID,
      counter: COUNTER,
    });
    expect(onTokenId).not.toHaveBeenCalled();
    expect(chainCalls()).toBe(1);
  });

  it("reports a failed lookup instead of a verdict when the chain cannot be read", async () => {
    const { picc, cmac } = mintTap();

    chain.getTokenByTag.mockRejectedValueOnce(new Error("rpc down"));
    expect((await resolveTap(picc, cmac)).kind).toBe("lookup-failed");

    chain.getAsset.mockRejectedValueOnce(new Error("rpc down"));
    expect((await resolveTap(picc, cmac)).kind).toBe("lookup-failed");
  });

  it("still resolves when only the record hash cannot be read", async () => {
    chain.getMetadataHash.mockRejectedValue(new Error("no such getter"));
    const { picc, cmac } = mintTap();

    const res = await resolveTap(picc, cmac);

    expect(res).toMatchObject({ kind: "resolved", tokenId: TOKEN_ID, metadataHash: null });
  });

  it("says the tag was read before it first waits for the chain, and only for a tag that passes", async () => {
    chain.getTokenByTag.mockReturnValue(new Promise(() => {})); // the chain never answers
    const { picc, cmac } = mintTap();

    const onTagRead = vi.fn();
    void resolveTap(picc, cmac, { onTagRead });
    // No await yet: the signal must already have fired.
    expect(onTagRead).toHaveBeenCalledTimes(1);

    const tampered = cmac.slice(0, -1) + (cmac.endsWith("0") ? "1" : "0");
    const onTamperedRead = vi.fn();
    await resolveTap(picc, tampered, { onTagRead: onTamperedRead });
    expect(onTamperedRead).not.toHaveBeenCalled();
  });

  it("a timer records the four steps and changes nothing about the result", async () => {
    const { picc, cmac } = mintTap();
    const timer = createTapTimer();

    const timedResult = await resolveTap(picc, cmac, { timer });
    const plainResult = await resolveTap(picc, cmac);

    expect(timedResult).toEqual(plainResult);
    expect(Object.keys(timer.spans()).sort()).toEqual(["chain", "link", "sdm", "tag", "total"]);
  });
});

describe("resolveTap — a link is opened once (TAP-T10)", () => {
  it("opens the link with the tag, the item, the counter and the device", async () => {
    const { picc, cmac } = mintTap(1234);

    await resolveTap(picc, cmac, { device: DEVICE });

    expect(store.openTapLink).toHaveBeenCalledExactlyOnceWith({
      tagHash: uidToTagHash(UID),
      tokenId: "58",
      counter: 1234,
      device: DEVICE,
    });
  });

  it("passes the country on when there is one", async () => {
    const { picc, cmac } = mintTap(1234);

    await resolveTap(picc, cmac, { device: DEVICE, country: "FR" });

    expect(store.openTapLink).toHaveBeenCalledExactlyOnceWith({
      tagHash: uidToTagHash(UID),
      tokenId: "58",
      counter: 1234,
      device: DEVICE,
      country: "FR",
    });
  });

  it("opens it with no device when the caller has none — there is no way to skip the step", async () => {
    const { picc, cmac } = mintTap();

    await resolveTap(picc, cmac);
    await resolveTap(picc, cmac, {});
    await resolveTap(picc, cmac, { device: null });

    expect(store.openTapLink).toHaveBeenCalledTimes(3);
    for (const [request] of store.openTapLink.mock.calls) {
      expect(request).toMatchObject({ counter: COUNTER, device: null });
    }
  });

  it("asks the store and the chain together, and tells the caller the item only once the link is good", async () => {
    const order: string[] = [];
    const opening = deferred<TapLinkUse>();
    const asset = deferred<typeof ASSET>();
    store.openTapLink.mockImplementation(() => {
      order.push("link:asked");
      return opening.promise;
    });
    chain.getAsset.mockImplementation(() => {
      order.push("state:asked");
      return asset.promise;
    });
    chain.getMetadataHash.mockImplementation(() => {
      order.push("hash:asked");
      return Promise.resolve(RECORD_HASH);
    });
    const { picc, cmac } = mintTap();

    const pending = resolveTap(picc, cmac, { onTokenId: () => order.push("item known") });
    await settle();

    // All three are out; the caller has not been told the item yet.
    expect(order).toEqual(["link:asked", "state:asked", "hash:asked"]);

    opening.resolve(FRESH);
    await settle();
    // The link is good: now the caller may ask for the item's record, while the
    // item read is still out.
    expect(order).toEqual(["link:asked", "state:asked", "hash:asked", "item known"]);

    asset.resolve(ASSET);
    expect((await pending).kind).toBe("resolved");
  });

  it("a fresh link goes on to a result marked fresh", async () => {
    const { picc, cmac } = mintTap();
    expect(await resolveTap(picc, cmac)).toMatchObject({
      kind: "resolved",
      link: { kind: "fresh" },
    });
  });

  it("the same phone opening its link again goes on to a result marked as an earlier check", async () => {
    store.openTapLink.mockResolvedValue({ kind: "again", secondsAgo: 185 });
    const onTokenId = vi.fn();
    const { picc, cmac } = mintTap();

    expect(await resolveTap(picc, cmac, { device: DEVICE, onTokenId })).toEqual({
      kind: "resolved",
      uid: UID,
      counter: COUNTER,
      tokenId: TOKEN_ID,
      asset: ASSET,
      metadataHash: RECORD_HASH,
      link: { kind: "again", secondsAgo: 185 },
    });
    expect(onTokenId).toHaveBeenCalledExactlyOnceWith(TOKEN_ID);
  });

  it("a used link ends there: no result, and the caller is never told the item", async () => {
    store.openTapLink.mockResolvedValue({ kind: "used" });
    const onTokenId = vi.fn();
    const { picc, cmac } = mintTap();

    const res = await resolveTap(picc, cmac, { device: DEVICE, onTokenId });

    expect(res).toEqual({ kind: "link-used", uid: UID, counter: COUNTER });
    expect(res).not.toHaveProperty("asset");
    expect(res).not.toHaveProperty("tokenId");
    expect(onTokenId).not.toHaveBeenCalled();
  });

  it("a store that does not answer ends as 'not checked', never as a result", async () => {
    store.openTapLink.mockResolvedValue({ kind: "unavailable" });
    const onTokenId = vi.fn();
    const { picc, cmac } = mintTap();

    const res = await resolveTap(picc, cmac, { onTokenId });

    expect(res).toEqual({ kind: "link-unchecked", uid: UID, counter: COUNTER });
    expect(onTokenId).not.toHaveBeenCalled();
  });

  it("a store call that throws is 'not checked' too", async () => {
    store.openTapLink.mockRejectedValue(new Error("boom"));
    const onTokenId = vi.fn();
    const { picc, cmac } = mintTap();

    const res = await resolveTap(picc, cmac, { onTokenId });

    expect(res).toEqual({ kind: "link-unchecked", uid: UID, counter: COUNTER });
    expect(onTokenId).not.toHaveBeenCalled();
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["an empty object", {}],
    ["a kind it does not know", { kind: "ok" }],
    ["the right word in the wrong case", { kind: "FRESH" }],
    ["a bare word", "fresh"],
    ["'again' with no age", { kind: "again" }],
    ["'again' with a negative age", { kind: "again", secondsAgo: -5 }],
    ["'again' with an age that is not a number", { kind: "again", secondsAgo: "185" }],
    ["'again' with an endless age", { kind: "again", secondsAgo: Number.POSITIVE_INFINITY }],
  ])("an answer it does not know (%s) is 'not checked', never a result", async (_name, answer) => {
    store.openTapLink.mockResolvedValue(answer);
    const onTokenId = vi.fn();
    const { picc, cmac } = mintTap();

    const res = await resolveTap(picc, cmac, { onTokenId });

    expect(res).toEqual({ kind: "link-unchecked", uid: UID, counter: COUNTER });
    expect(onTokenId).not.toHaveBeenCalled();
  });

  it("passes on only what it knows from a good answer", async () => {
    store.openTapLink.mockResolvedValue({ kind: "again", secondsAgo: 30, extra: "x" });
    const { picc, cmac } = mintTap();

    const res = await resolveTap(picc, cmac);

    expect(res).toMatchObject({ kind: "resolved" });
    expect((res as { link: unknown }).link).toEqual({ kind: "again", secondsAgo: 30 });
  });

  it("opens no link for a tap that does not lead to an item", async () => {
    const { picc, cmac } = mintTap();
    const tampered = cmac.slice(0, -1) + (cmac.endsWith("0") ? "1" : "0");

    await resolveTap(undefined, cmac); // nothing to check
    await resolveTap(picc, tampered); // the code fails its check
    chain.getTokenByTag.mockResolvedValueOnce(0n);
    await resolveTap(picc, cmac); // a real tag with no item
    chain.getTokenByTag.mockRejectedValueOnce(new Error("rpc down"));
    await resolveTap(picc, cmac); // the item could not be looked up
    delete process.env.SDM_MASTER_KEY;
    await resolveTap(picc, cmac); // this server cannot check codes at all

    expect(store.openTapLink).not.toHaveBeenCalled();
  });

  it("a failed item read after the link was opened is a failed lookup, not a result", async () => {
    chain.getAsset.mockRejectedValue(new Error("rpc down"));
    const { picc, cmac } = mintTap();

    const res = await resolveTap(picc, cmac);

    expect(res.kind).toBe("lookup-failed");
    expect(store.openTapLink).toHaveBeenCalledTimes(1);
  });
});
