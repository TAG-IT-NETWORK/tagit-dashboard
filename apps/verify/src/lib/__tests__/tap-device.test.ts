import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { tapDeviceOf } from "../tap-device";
import {
  TAP_DEVICE_HEADER,
  TAP_DEVICE_MAX_AGE_SECONDS,
  isTapDeviceId,
  newTapDeviceId,
  tapDeviceCookieName,
} from "../tap-device-cookie";

/**
 * TAP-T10: the id that lets one phone open its own tap link again, and what
 * the one-time store is told about it (a hash, never the id).
 */

const withDevice = (value?: string) =>
  new Headers(value === undefined ? {} : { [TAP_DEVICE_HEADER]: value });

describe("a device id", () => {
  it("is 16 random bytes, written in 22 characters that are safe in a cookie", () => {
    const id = newTapDeviceId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(id, "base64url")).toHaveLength(16);
    expect(isTapDeviceId(id)).toBe(true);
  });

  it("is different every time", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newTapDeviceId()));
    expect(ids.size).toBe(2000);
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["an empty string", ""],
    ["one character short", "A".repeat(21)],
    ["one character long", "A".repeat(23)],
    ["a character base64url does not use", `${"A".repeat(21)}+`],
    ["padding", `${"A".repeat(21)}=`],
    ["a space", `${"A".repeat(21)} `],
    ["a number", 1234567890123456],
    ["something much longer", "A".repeat(5000)],
  ])("is not %s", (_name, value) => {
    expect(isTapDeviceId(value)).toBe(false);
  });
});

describe("the cookie that holds it", () => {
  it("is locked to this exact host over https, and plainly named on a developer machine", () => {
    expect(tapDeviceCookieName(true)).toBe("__Host-tap-device");
    expect(tapDeviceCookieName(false)).toBe("tap-device");
  });

  it("outlives the ten minutes a link may be reopened, and not by much", () => {
    expect(TAP_DEVICE_MAX_AGE_SECONDS).toBe(15 * 60);
    expect(TAP_DEVICE_MAX_AGE_SECONDS).toBeGreaterThan(10 * 60);
  });
});

describe("tapDeviceOf — what the one-time store is told", () => {
  it("a SHA-256 of the id, in lower-case hex", () => {
    const id = newTapDeviceId();
    const device = tapDeviceOf(withDevice(id));

    expect(device).toBe(createHash("sha256").update(id).digest("hex"));
    expect(device).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never the id itself", () => {
    const id = newTapDeviceId();
    expect(tapDeviceOf(withDevice(id))).not.toContain(id);
  });

  it("the same for the same id, different for another", () => {
    const one = newTapDeviceId();
    const other = newTapDeviceId();
    expect(tapDeviceOf(withDevice(one))).toBe(tapDeviceOf(withDevice(one)));
    expect(tapDeviceOf(withDevice(one))).not.toBe(tapDeviceOf(withDevice(other)));
  });

  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["a value that is not an id", "my-phone"],
    ["an id with one character too many", "A".repeat(23)],
    ["a hash sent in place of an id", "d".repeat(64)],
  ])(
    "null for %s — a tap with no device is still checked, it just has no second look",
    (_name, value) => {
      expect(tapDeviceOf(withDevice(value))).toBeNull();
    },
  );
});
