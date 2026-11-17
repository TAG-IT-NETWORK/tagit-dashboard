import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The chain reads, the one-time link store and the item record, each replaced
// by something the test controls.
const chain = vi.hoisted(() => ({
  getTokenByTag: vi.fn(),
  getAsset: vi.fn(),
  getMetadataHash: vi.fn(),
}));
vi.mock("@/lib/contract.server", () => chain);

const store = vi.hoisted(() => ({ openTapLink: vi.fn() }));
vi.mock("@/lib/tap-link", () => store);

const record = vi.hoisted(() => ({ loadProduct: vi.fn() }));
vi.mock("@/lib/dpp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dpp")>()),
  loadProduct: record.loadProduct,
}));

import { GET as dpp } from "@/app/api/dpp/[...segments]/route";
import { GET as verify } from "@/app/api/verify/route";
import { TAP_STATES } from "@/lib/consumer-copy";
import { uidToTagHash } from "@/lib/contract";
import { mintSunUrl } from "@/lib/sdm";
import { TAP_DEVICE_HEADER, newTapDeviceId } from "@/lib/tap-device-cookie";

/**
 * TAP-T10: the two JSON tap routes. /api/verify is what the TAG IT app calls;
 * /api/dpp is the machine-readable passport. A tap link answers on them once,
 * exactly as it does on the pages, and a used link is never "verified".
 */

/** A test-only tag key (sequential bytes). Never a real tag key. */
const TEST_TAG_KEY_HEX = "000102030405060708090a0b0c0d0e0f";
const UID = "04A1B2C3D4E5F6";
const OWNER = "0x00000000000000000000000000000000000000A1";
const ASSET = { owner: OWNER, timestamp: 1_760_000_000n, state: 4, flags: 0, reserved: 0 };
const PRODUCT = { name: "Renewal Cream", brand: "TAG IT Demo", image: null, sku: "TD-RC-50" };
const USED = `${TAP_STATES.linkUsed.headline}. ${TAP_STATES.linkUsed.line}.`;

function tapQuery(counter = 42): string {
  const url = new URL(
    mintSunUrl(
      "https://verify.example/sun",
      Buffer.from(TEST_TAG_KEY_HEX, "hex"),
      Buffer.from(UID, "hex"),
      counter,
    ),
  );
  return url.search;
}

const callVerify = (query = tapQuery(), headers: Record<string, string> = {}) =>
  verify(new Request(`https://verify.tagit.network/api/verify${query}`, { headers }));

const callDpp = (query = tapQuery(), headers: Record<string, string> = {}, path = "token/58") =>
  dpp(new Request(`https://verify.tagit.network/api/dpp/${path}${query}`, { headers }), {
    params: Promise.resolve({ segments: path.split("/") }),
  });

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.SDM_MASTER_KEY;
  process.env.SDM_MASTER_KEY = TEST_TAG_KEY_HEX;
  chain.getTokenByTag.mockReset().mockResolvedValue(58n);
  chain.getAsset.mockReset().mockResolvedValue(ASSET);
  chain.getMetadataHash.mockReset().mockResolvedValue(null);
  store.openTapLink.mockReset().mockResolvedValue({ kind: "fresh" });
  record.loadProduct.mockReset().mockResolvedValue(PRODUCT);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.SDM_MASTER_KEY;
  else process.env.SDM_MASTER_KEY = savedKey;
  vi.restoreAllMocks();
});

describe("GET /api/verify — the app's check", () => {
  it("a fresh link: verified, with the product, and marked fresh", async () => {
    const res = await callVerify();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      verified: true,
      bound: true,
      uid: UID,
      tapCounter: 42,
      tapLink: "fresh",
      asset: { tokenId: "58", stateCode: 4, name: "Renewal Cream" },
    });
  });

  it("keeps every field the app already reads, and adds exactly one", async () => {
    const body = await (await callVerify()).json();
    expect(Object.keys(body).sort()).toEqual(
      [
        "asset",
        "bound",
        "chain",
        "metadataHash",
        "tapCounter",
        "tapLink",
        "uid",
        "verified",
      ].sort(),
    );
  });

  it("the same device again: the same answer, marked again", async () => {
    store.openTapLink.mockResolvedValue({ kind: "again", secondsAgo: 185 });

    const body = await (await callVerify()).json();

    expect(body).toMatchObject({ verified: true, tapLink: "again", asset: { tokenId: "58" } });
  });

  it("a used link: not verified, no product, and the reason in plain words", async () => {
    store.openTapLink.mockResolvedValue({ kind: "used" });

    const res = await callVerify();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      verified: false,
      bound: true,
      uid: UID,
      tapCounter: 42,
      reason: USED,
      tapLink: "used",
      chain: { id: 84532, name: "Base Sepolia" },
    });
    expect(body).not.toHaveProperty("asset");
    expect(JSON.stringify(body)).not.toContain(OWNER);
    expect(JSON.stringify(body)).not.toContain("Renewal Cream");
    // the item's record is never asked for
    expect(record.loadProduct).not.toHaveBeenCalled();
  });

  it("a store that does not answer: 503, not verified, no product", async () => {
    store.openTapLink.mockResolvedValue({ kind: "unavailable" });

    const res = await callVerify();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.verified).toBe(false);
    expect(body.error).toBe(`${TAP_STATES.ourSide.headline}. ${TAP_STATES.ourSide.line}.`);
    expect(body).not.toHaveProperty("asset");
    expect(body).not.toHaveProperty("tapLink");
    expect(record.loadProduct).not.toHaveBeenCalled();
  });

  it("tells the store which device is asking: a hash of the id, never the id", async () => {
    const id = newTapDeviceId();

    await callVerify(tapQuery(7), { [TAP_DEVICE_HEADER]: id });

    expect(store.openTapLink).toHaveBeenCalledExactlyOnceWith({
      tagHash: uidToTagHash(UID),
      tokenId: "58",
      counter: 7,
      device: createHash("sha256").update(id).digest("hex"),
    });
  });

  it("asks with no device when the request carries none", async () => {
    await callVerify();
    expect(store.openTapLink.mock.calls[0]![0]).toMatchObject({ device: null });
  });

  it("a code that fails its check never reaches the store", async () => {
    const res = await callVerify("?picc=00112233445566778899AABBCCDDEEFF&cmac=0011223344556677");

    expect((await res.json()).verified).toBe(false);
    expect(store.openTapLink).not.toHaveBeenCalled();
  });

  it.each([
    ["fresh", { kind: "fresh" }],
    ["again", { kind: "again", secondsAgo: 5 }],
    ["used", { kind: "used" }],
    ["unavailable", { kind: "unavailable" }],
  ])("is never stored by a cache (%s)", async (_name, answer) => {
    store.openTapLink.mockResolvedValue(answer);
    const res = await callVerify();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("never says verified for anything but a fresh link or the same device again", async () => {
    for (const answer of [{ kind: "used" }, { kind: "unavailable" }, {}, null, { kind: "ok" }]) {
      store.openTapLink.mockResolvedValue(answer);
      const body = await (await callVerify()).json();
      expect(body.verified, JSON.stringify(answer)).toBe(false);
      expect(body, JSON.stringify(answer)).not.toHaveProperty("asset");
    }
  });
});

describe("GET /api/dpp — the machine-readable passport", () => {
  it("a fresh link: the passport, marked fresh, checked now", async () => {
    const before = Date.now();
    const res = await callDpp();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-tap-link")).toBe("fresh");
    expect(body.type).toContain("DigitalProductPassport");
    expect(Date.parse(body.validFrom)).toBeGreaterThanOrEqual(before - 1000);
    expect(Date.parse(body.validFrom)).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("the same device again: the passport, marked again, dated to when the link was first opened", async () => {
    store.openTapLink.mockResolvedValue({ kind: "again", secondsAgo: 185 });
    const before = Date.now();

    const res = await callDpp();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-tap-link")).toBe("again");
    const checkedAt = Date.parse(body.validFrom);
    expect(checkedAt).toBeGreaterThanOrEqual(before - 185_000 - 1000);
    expect(checkedAt).toBeLessThanOrEqual(Date.now() - 185_000 + 1000);
  });

  it("a used link: no passport", async () => {
    store.openTapLink.mockResolvedValue({ kind: "used" });

    const res = await callDpp();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-tap-link")).toBe("used");
    expect(body).toEqual({ verified: false, reason: USED, tapLink: "used" });
    expect(JSON.stringify(body)).not.toContain(OWNER);
    expect(record.loadProduct).not.toHaveBeenCalled();
  });

  it("a store that does not answer: 503 and no passport", async () => {
    store.openTapLink.mockResolvedValue({ kind: "unavailable" });

    const res = await callDpp();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.verified).toBe(false);
    expect(body).not.toHaveProperty("type");
    expect(JSON.stringify(body)).not.toContain(OWNER);
  });

  it("tells the store which device is asking, on both forms of the address", async () => {
    const id = newTapDeviceId();
    const device = createHash("sha256").update(id).digest("hex");

    await callDpp(tapQuery(9), { [TAP_DEVICE_HEADER]: id });
    await callDpp(tapQuery(10), { [TAP_DEVICE_HEADER]: id }, "01/09506000134352/21/SN-1");

    expect(store.openTapLink.mock.calls.map(([request]) => request)).toEqual([
      { tagHash: uidToTagHash(UID), tokenId: "58", counter: 9, device },
      { tagHash: uidToTagHash(UID), tokenId: "58", counter: 10, device },
    ]);
  });

  it.each([
    ["fresh", { kind: "fresh" }],
    ["used", { kind: "used" }],
    ["unavailable", { kind: "unavailable" }],
  ])("is never stored by a cache (%s)", async (_name, answer) => {
    store.openTapLink.mockResolvedValue(answer);
    const res = await callDpp();
    expect(res.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
  });
});
