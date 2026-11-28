import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The request's headers, as the middleware leaves them for a tap route.
const incoming = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => incoming.headers }));

// The check itself is replaced: these tests are about what the page hands it.
const taps = vi.hoisted(() => ({ startTapRun: vi.fn() }));
vi.mock("@/lib/tap-run", () => taps);

import Gs1ResolverPage from "@/app/01/[...segments]/page";
import SunVerifyPage from "@/app/sun/page";
import { startTapLookups } from "@/lib/tap-lookups";
import { TAP_DEVICE_HEADER, newTapDeviceId } from "@/lib/tap-device-cookie";

/**
 * TAP-T10: both tap pages hand the check the requesting device, so the same
 * phone can open its own link again. They hand it a hash of the id the
 * middleware set, never the id, and nothing at all when there is no id.
 */

const PICC = "00112233445566778899AABBCCDDEEFF";
const CMAC = "0011223344556677";
const RUN = {
  tagRead: true,
  secondTick: new Promise<boolean>(() => {}),
  resolution: new Promise<never>(() => {}),
};

const sun = (query: Record<string, string> = { picc: PICC, cmac: CMAC }) =>
  SunVerifyPage({ searchParams: Promise.resolve(query) });
const gs1 = (query: Record<string, string> = { picc: PICC, cmac: CMAC }) =>
  Gs1ResolverPage({
    params: Promise.resolve({ segments: ["09506000134352", "21", "SN-1"] }),
    searchParams: Promise.resolve(query),
  });

beforeEach(() => {
  incoming.headers = new Headers();
  taps.startTapRun.mockReset().mockReturnValue(RUN);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe.each([
  ["/sun", sun],
  ["/01/…", gs1],
])("the %s page", (_name, page) => {
  it("hands the check a hash of the device id the middleware set", async () => {
    const id = newTapDeviceId();
    incoming.headers = new Headers({ [TAP_DEVICE_HEADER]: id });

    await page();

    expect(taps.startTapRun).toHaveBeenCalledExactlyOnceWith(PICC, CMAC, startTapLookups, {
      device: createHash("sha256").update(id).digest("hex"),
    });
    expect(JSON.stringify(taps.startTapRun.mock.calls)).not.toContain(id);
  });

  it("hands the check the shopper's country and nothing else about where they are", async () => {
    incoming.headers = new Headers({
      "x-vercel-ip-country": "de",
      "x-forwarded-for": "203.0.113.9",
      "x-real-ip": "203.0.113.9",
      "x-vercel-ip-city": "Berlin",
      "x-vercel-ip-latitude": "52.52",
    });

    await page();

    expect(taps.startTapRun).toHaveBeenCalledExactlyOnceWith(PICC, CMAC, startTapLookups, {
      device: null,
      country: "DE",
    });
    const sent = JSON.stringify(taps.startTapRun.mock.calls);
    for (const never of ["203.0.113.9", "Berlin", "52.52"]) expect(sent).not.toContain(never);
  });

  it("hands it no device when the request carries no usable id", async () => {
    for (const headers of [new Headers(), new Headers({ [TAP_DEVICE_HEADER]: "not-an-id" })]) {
      taps.startTapRun.mockClear();
      incoming.headers = headers;

      await page();

      expect(taps.startTapRun).toHaveBeenCalledExactlyOnceWith(PICC, CMAC, startTapLookups, {
        device: null,
      });
    }
  });

  it("starts no check at all for a link with parts missing", async () => {
    await page({ picc: PICC });
    await page({});

    expect(taps.startTapRun).not.toHaveBeenCalled();
  });
});
