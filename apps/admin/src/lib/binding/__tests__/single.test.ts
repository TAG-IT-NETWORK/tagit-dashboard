import { describe, expect, it, vi } from "vitest";

import { parseTokenIdInput, readSingleAsset, verifyThenBind, type PostJson } from "../single";

const UID = "04:A1:B2:C3:D4:E5:F6";
const SUN_URL =
  "https://verify.tagit.network/sun?uid=04A1B2C3D4E5F6&ctr=00000A&cmac=0102030405060708";
const goodRead = async () => [{ recordType: "url", data: SUN_URL }];

const VERIFY = "/api/catalog-proxy/binding/verify";
const BIND = "/api/catalog-proxy/binding/bind";

/** Route-keyed fake for the two proxies; records every call in order. */
function fakePost(
  routes: Record<string, { ok: boolean; status: number; body: Record<string, unknown> | null }>,
) {
  const calls: Array<{ path: string; payload: unknown }> = [];
  const post: PostJson = async (path, payload) => {
    calls.push({ path, payload });
    const r = routes[path];
    if (!r) throw new Error(`unexpected call to ${path}`);
    return r;
  };
  return { post, calls };
}

describe("parseTokenIdInput", () => {
  it("accepts plain, #-prefixed and padded numbers, canonicalized", () => {
    expect(parseTokenIdInput("59")).toBe("59");
    expect(parseTokenIdInput(" #59 ")).toBe("59");
    expect(parseTokenIdInput("059")).toBe("59");
  });

  it("accepts the largest safe id and refuses anything above it (verify path is a JS number)", () => {
    expect(parseTokenIdInput(String(Number.MAX_SAFE_INTEGER))).toBe(
      String(Number.MAX_SAFE_INTEGER),
    );
    expect(parseTokenIdInput((BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString())).toBeNull();
  });

  it("rejects empty, non-numeric, negative and oversized input", () => {
    for (const bad of [null, undefined, "", "abc", "-1", "5 9", "1".repeat(79)]) {
      expect(parseTokenIdInput(bad as string)).toBeNull();
    }
  });
});

describe("readSingleAsset", () => {
  it("marks a MINTED, tagless token bindable", () => {
    const info = readSingleAsset("59", 200, {
      name: "PDRN Cream",
      stateCode: 1,
      lifecycleState: "MINTED",
    });
    expect(info).toMatchObject({ tokenId: "59", name: "PDRN Cream", bindable: true, reason: null });
  });

  it("refuses a token that already carries a tag", () => {
    const info = readSingleAsset("58", 200, { stateCode: 2, tagHash: "0x55b9" });
    expect(info.bindable).toBe(false);
    expect(info.reason).toContain("already has a chip");
  });

  it("treats a zero tagHash as no tag", () => {
    const info = readSingleAsset("59", 200, { stateCode: 1, tagHash: `0x${"0".repeat(64)}` });
    expect(info.bindable).toBe(true);
  });

  it("refuses non-MINTED states", () => {
    const info = readSingleAsset("40", 200, { stateCode: 3, lifecycleState: "ACTIVATED" });
    expect(info.bindable).toBe(false);
    expect(info.reason).toContain("ACTIVATED");
  });

  it("reports unknown tokens and upstream errors", () => {
    expect(readSingleAsset("999", 404, { error: "NOT_FOUND" }).reason).toContain(
      "not in the catalog",
    );
    expect(readSingleAsset("59", 502, { error: "upstream down" }).reason).toContain(
      "upstream down",
    );
    expect(readSingleAsset("59", 0, null).bindable).toBe(false);
  });
});

describe("verifyThenBind — SUN first, bind last (REQ-S-21)", () => {
  it("binds after a verified SUN and reports the tx", async () => {
    const { post, calls } = fakePost({
      [VERIFY]: { ok: true, status: 200, body: { verified: true, cmacVerified: true } },
      [BIND]: { ok: true, status: 200, body: { ok: true, txHash: "0xabc" } },
    });
    const out = await verifyThenBind({
      tokenId: "59",
      uid: UID,
      chip: "NTAG424DNA",
      readNdef: goodRead,
      postJson: post,
    });
    expect(out).toEqual({ ok: true, txHash: "0xabc", cmacVerified: true });
    expect(calls.map((c) => c.path)).toEqual([VERIFY, BIND]);
    expect(calls[0].payload).toMatchObject({ tokenId: "59", nfcPayload: { counter: 10 } });
    expect(calls[1].payload).toEqual({ tokenId: "59", tagUid: UID });
  });

  it("never reads or binds a chip that is not NTAG 424 DNA", async () => {
    const readNdef = vi.fn(goodRead);
    const { post, calls } = fakePost({});
    const out = await verifyThenBind({
      tokenId: "59",
      uid: UID,
      chip: "NTAG215",
      readNdef,
      postJson: post,
    });
    expect(out).toMatchObject({ ok: false, stage: "sun", kind: "tamper" });
    expect(readNdef).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("flags a blank chip as programmable and calls nothing upstream", async () => {
    const { post, calls } = fakePost({});
    const out = await verifyThenBind({
      tokenId: "59",
      uid: UID,
      chip: "NTAG424DNA",
      readNdef: async () => ({ records: [], sun: null }),
      postJson: post,
    });
    expect(out).toMatchObject({ ok: false, stage: "sun", kind: "unreadable", blank: true });
    expect(calls).toHaveLength(0);
  });

  it("fails CLOSED when the verify service is unreachable", async () => {
    const { post, calls } = fakePost({ [VERIFY]: { ok: false, status: 0, body: null } });
    const out = await verifyThenBind({
      tokenId: "59",
      uid: UID,
      chip: "NTAG424DNA",
      readNdef: goodRead,
      postJson: post,
    });
    expect(out).toMatchObject({ ok: false, stage: "sun", kind: "unreadable" });
    expect(calls.map((c) => c.path)).toEqual([VERIFY]);
  });

  it("stops hard on CMAC_INVALID even if the body claims verified", async () => {
    const { post, calls } = fakePost({
      [VERIFY]: { ok: true, status: 200, body: { verified: true, reason: "CMAC_INVALID" } },
    });
    const out = await verifyThenBind({
      tokenId: "59",
      uid: UID,
      chip: "NTAG424DNA",
      readNdef: goodRead,
      postJson: post,
    });
    expect(out).toMatchObject({ ok: false, stage: "sun", kind: "tamper" });
    expect(out.ok === false && out.message).toContain("CMAC invalid");
    expect(calls.map((c) => c.path)).toEqual([VERIFY]);
  });

  it("does not bind when verify answers verified:false", async () => {
    const { post, calls } = fakePost({
      [VERIFY]: { ok: true, status: 200, body: { verified: false, error: "counter replay" } },
    });
    const out = await verifyThenBind({
      tokenId: "59",
      uid: UID,
      chip: "NTAG424DNA",
      readNdef: goodRead,
      postJson: post,
    });
    expect(out).toMatchObject({ ok: false, stage: "sun", message: "counter replay" });
    expect(calls.map((c) => c.path)).toEqual([VERIFY]);
  });

  it("surfaces a relayer bind failure with the upstream error", async () => {
    const { post } = fakePost({
      [VERIFY]: { ok: true, status: 200, body: { verified: true, cmacVerified: false } },
      [BIND]: { ok: false, status: 502, body: { ok: false, error: "MissingCapability" } },
    });
    const out = await verifyThenBind({
      tokenId: "59",
      uid: UID,
      chip: "NTAG424DNA",
      readNdef: goodRead,
      postJson: post,
    });
    expect(out).toEqual({
      ok: false,
      stage: "bind",
      message: "MissingCapability",
      cmacVerified: false,
    });
  });
});
