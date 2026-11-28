import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SERVICES_URL } from "../services";
import {
  TAP_LINK_TIMEOUT_MS,
  openTapLink,
  readTapLinkAnswer,
  tapLinkReadyUrl,
  tapLinkStoreState,
  tapLinkUrl,
  type TapLinkRequest,
} from "../tap-link";

/**
 * TAP-T10: asking tagit-services whether a tap link is being opened for the
 * first time. The rule under test: only three exact answers count; everything
 * else is "unavailable", and nothing is ever answered by default.
 */

const KEY = "services-key-for-this-test";
const REQUEST: TapLinkRequest = {
  tagHash: `0x${"a1".repeat(32)}`,
  tokenId: "58",
  counter: 42,
  device: "d".repeat(64),
};

const fetchMock = vi.fn();
let logged: string[];
let savedKey: string | undefined;

/** A response from tagit-services. */
const answer = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  savedKey = process.env.SERVICES_API_KEY;
  process.env.SERVICES_API_KEY = KEY;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.SERVICES_API_KEY;
  else process.env.SERVICES_API_KEY = savedKey;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openTapLink — what it sends", () => {
  it("posts the tag, the item, the counter and the device to the platform route, with the services key", async () => {
    fetchMock.mockResolvedValue(answer({ outcome: "fresh" }));

    await openTapLink(REQUEST);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SERVICES_URL}/api/v1/tap-links/open`);
    expect(url).toBe(tapLinkUrl());
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      authorization: `Bearer ${KEY}`,
    });
    expect(JSON.parse(init.body as string)).toEqual(REQUEST);
  });

  it("sends a null device when there is none", async () => {
    fetchMock.mockResolvedValue(answer({ outcome: "fresh" }));

    await openTapLink({ ...REQUEST, device: null });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ ...REQUEST, device: null });
  });

  it("sends the country when there is one, and no such key when there is none", async () => {
    fetchMock.mockImplementation(async () => answer({ outcome: "fresh" }));
    await openTapLink({ ...REQUEST, country: "DE" });
    await openTapLink({ ...REQUEST, country: null });
    await openTapLink(REQUEST);
    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse((call as [string, RequestInit])[1].body as string),
    );
    expect(bodies[0]).toEqual({ ...REQUEST, country: "DE" });
    expect(bodies[1]).toEqual(REQUEST);
    expect(bodies[2]).toEqual(REQUEST);
  });

  it("is never stored or reused, and gives up after its time limit", async () => {
    fetchMock.mockResolvedValue(answer({ outcome: "fresh" }));

    await openTapLink(REQUEST);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { next?: unknown }];
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(TAP_LINK_TIMEOUT_MS).toBe(8_000);
  });

  it("sends nothing at all when this server has no services key", async () => {
    for (const value of [undefined, "", "   "]) {
      if (value === undefined) delete process.env.SERVICES_API_KEY;
      else process.env.SERVICES_API_KEY = value;

      expect(await openTapLink(REQUEST)).toEqual({ kind: "unavailable" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("openTapLink — the three answers", () => {
  it("fresh", async () => {
    fetchMock.mockResolvedValue(answer({ outcome: "fresh" }));
    expect(await openTapLink(REQUEST)).toEqual({ kind: "fresh" });
  });

  it("used", async () => {
    fetchMock.mockResolvedValue(answer({ outcome: "used" }));
    expect(await openTapLink(REQUEST)).toEqual({ kind: "used" });
  });

  it("again, with how long ago the link was first opened", async () => {
    fetchMock.mockResolvedValue(answer({ outcome: "again", openedSecondsAgo: 185 }));
    expect(await openTapLink(REQUEST)).toEqual({ kind: "again", secondsAgo: 185 });

    fetchMock.mockResolvedValue(answer({ outcome: "again", openedSecondsAgo: 0 }));
    expect(await openTapLink(REQUEST)).toEqual({ kind: "again", secondsAgo: 0 });
  });

  it("ignores anything else that comes with a good answer", async () => {
    fetchMock.mockResolvedValue(answer({ outcome: "fresh", note: "hello", openedSecondsAgo: 3 }));
    expect(await openTapLink(REQUEST)).toEqual({ kind: "fresh" });
  });
});

describe("openTapLink — everything else is 'unavailable'", () => {
  it.each([
    ["an empty object", {}],
    ["null", null],
    ["a list", ["fresh"]],
    ["a bare word", "fresh"],
    ["a number", 1],
    ["true", true],
    ["an outcome it does not know", { outcome: "ok" }],
    ["the right word in the wrong case", { outcome: "Fresh" }],
    ["the right word with a space", { outcome: "fresh " }],
    ["an outcome that is not text", { outcome: 1 }],
    ["an outcome nested one level down", { result: { outcome: "fresh" } }],
    ["'again' with no age", { outcome: "again" }],
    ["'again' with a negative age", { outcome: "again", openedSecondsAgo: -1 }],
    ["'again' with a fraction", { outcome: "again", openedSecondsAgo: 1.5 }],
    ["'again' with an age as text", { outcome: "again", openedSecondsAgo: "185" }],
    ["'again' with a null age", { outcome: "again", openedSecondsAgo: null }],
  ])("%s", async (_name, body) => {
    fetchMock.mockResolvedValue(answer(body));
    expect(await openTapLink(REQUEST)).toEqual({ kind: "unavailable" });
    expect(readTapLinkAnswer(body)).toEqual({ kind: "unavailable" });
  });

  it.each([201, 202, 204, 301, 400, 401, 403, 404, 409, 429, 500, 502, 503])(
    "status %i, even when the body says fresh",
    async (status) => {
      // 204 and 304 cannot carry a body; the others say "fresh" on purpose.
      fetchMock.mockResolvedValue(
        status === 204 ? new Response(null, { status }) : answer({ outcome: "fresh" }, status),
      );
      expect(await openTapLink(REQUEST)).toEqual({ kind: "unavailable" });
    },
  );

  it("a 200 whose body is not JSON", async () => {
    fetchMock.mockResolvedValue(answer("<html>gateway error</html>"));
    expect(await openTapLink(REQUEST)).toEqual({ kind: "unavailable" });
  });

  it("a 200 with an empty body", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    expect(await openTapLink(REQUEST)).toEqual({ kind: "unavailable" });
  });

  it("a request that fails, and one that runs out of time", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await openTapLink(REQUEST)).toEqual({ kind: "unavailable" });

    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    fetchMock.mockRejectedValue(timeout);
    expect(await openTapLink(REQUEST)).toEqual({ kind: "unavailable" });
  });

  it("never rejects, whatever fetch does", async () => {
    fetchMock.mockImplementation(() => {
      throw new Error("thrown before a promise even exists");
    });
    await expect(openTapLink(REQUEST)).resolves.toEqual({ kind: "unavailable" });
  });
});

describe("openTapLink — what it writes to the log", () => {
  it("one line for a tap it could not check, and none for one it could", async () => {
    fetchMock.mockResolvedValue(answer({ outcome: "fresh" }));
    await openTapLink(REQUEST);
    fetchMock.mockResolvedValue(answer({ outcome: "used" }));
    await openTapLink(REQUEST);
    expect(logged).toHaveLength(0);

    fetchMock.mockResolvedValue(answer({ error: "INTERNAL_ERROR" }, 500));
    await openTapLink(REQUEST);
    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0]!)).toEqual({ evt: "tap-link", unavailable: "status 500" });
  });

  it("never the key, the tag or the device", async () => {
    fetchMock.mockResolvedValueOnce(answer({ outcome: "fresh" }, 403));
    await openTapLink(REQUEST);
    fetchMock.mockResolvedValueOnce(answer({ outcome: "what" }));
    await openTapLink(REQUEST);
    fetchMock.mockRejectedValueOnce(new Error(`connect failed for Bearer ${KEY}`));
    await openTapLink(REQUEST);
    delete process.env.SERVICES_API_KEY;
    await openTapLink(REQUEST);

    expect(logged).toHaveLength(4);
    for (const line of logged) {
      expect(line).not.toContain(KEY);
      expect(line).not.toContain(REQUEST.tagHash);
      expect(line).not.toContain(REQUEST.device);
    }
  });
});

describe("tapLinkStoreState — can this server use the store at all", () => {
  it("asks the readiness route with the services key, and never stores the answer", async () => {
    fetchMock.mockResolvedValue(answer({ ok: true }));

    expect(await tapLinkStoreState()).toEqual({ ready: true, status: 200 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SERVICES_URL}/api/v1/tap-links/ready`);
    expect(url).toBe(tapLinkReadyUrl());
    expect(init.method ?? "GET").toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers).toMatchObject({ authorization: `Bearer ${KEY}` });
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["the route is not deployed", 404],
    ["this server's key is not the platform's", 403],
    ["this server's key is not a key at all", 401],
    ["the table is missing", 500],
  ])("is not ready when %s, and says with which status", async (_name, status) => {
    fetchMock.mockResolvedValue(answer({ ok: true }, status));
    expect(await tapLinkStoreState()).toEqual({ ready: false, status });
  });

  it.each([
    ["an empty object", {}],
    ["ok: false", { ok: false }],
    ["ok as text", { ok: "true" }],
    ["a body that is not JSON", "<html>"],
  ])("is not ready on a 200 with %s", async (_name, body) => {
    fetchMock.mockResolvedValue(answer(body));
    expect(await tapLinkStoreState()).toEqual({ ready: false, status: 200 });
  });

  it("is not ready, and asks nothing, when this server has no services key", async () => {
    delete process.env.SERVICES_API_KEY;
    expect(await tapLinkStoreState()).toEqual({ ready: false, status: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is not ready when the request fails, and never rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(tapLinkStoreState()).resolves.toEqual({ ready: false, status: null });
  });
});
