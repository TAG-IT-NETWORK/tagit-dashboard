import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/warm/route";
import { SERVICES_URL } from "@/lib/services";

/**
 * TAP-T10: the keep-warm run also reports whether this server can use the
 * one-time link store. When it cannot, every tap ends as "We couldn't finish
 * the check", so this is where that shows first.
 */

const KEY = "services-key-for-this-test";
const fetchMock = vi.fn();
let savedKey: string | undefined;
let savedCron: string | undefined;

/** Answers for every request the warm run makes; the readiness answer is set per test. */
function answering(ready: () => Response) {
  fetchMock.mockImplementation(async (url: string) =>
    String(url).endsWith("/api/v1/tap-links/ready") ? ready() : new Response("ok", { status: 200 }),
  );
}

const readyCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/v1/tap-links/ready"));

beforeEach(() => {
  savedKey = process.env.SERVICES_API_KEY;
  savedCron = process.env.CRON_SECRET;
  process.env.SERVICES_API_KEY = KEY;
  delete process.env.CRON_SECRET;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.SERVICES_API_KEY;
  else process.env.SERVICES_API_KEY = savedKey;
  if (savedCron === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedCron;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/warm", () => {
  it("reports the one-time store as ready when tagit-services says so", async () => {
    answering(() => Response.json({ ok: true }));

    const body = await (await GET(new Request("https://verify.tagit.network/api/warm"))).json();

    expect(body.tapLinks).toMatchObject({ ready: true, status: 200 });
    expect(typeof body.tapLinks.ms).toBe("number");
    expect(body.ok).toBe(true);
    expect(body.results).toHaveLength(4);
  });

  it.each([
    ["the route is missing", 404],
    ["the key is refused", 403],
    ["the table is missing", 500],
  ])("reports it as not ready when %s, with the status", async (_name, status) => {
    answering(() => Response.json({ error: "x" }, { status }));

    const body = await (await GET(new Request("https://verify.tagit.network/api/warm"))).json();

    expect(body.tapLinks).toMatchObject({ ready: false, status });
  });

  it("asks once, with this server's key, and only after the other probes have answered", async () => {
    const order: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      const isReady = String(url).endsWith("/api/v1/tap-links/ready");
      order.push(isReady ? "ready:asked" : "probe:asked");
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(isReady ? "ready:answered" : "probe:answered");
      return isReady ? Response.json({ ok: true }) : new Response("ok");
    });

    await GET(new Request("https://verify.tagit.network/api/warm"));

    expect(readyCalls()).toHaveLength(1);
    const [url, init] = readyCalls()[0] as [string, RequestInit];
    expect(url).toBe(`${SERVICES_URL}/api/v1/tap-links/ready`);
    expect(init.headers).toMatchObject({ authorization: `Bearer ${KEY}` });
    // every probe has answered before the store is asked
    expect(order.indexOf("ready:asked")).toBeGreaterThan(order.lastIndexOf("probe:answered"));
  });

  it("never puts the key in what it returns", async () => {
    answering(() => Response.json({ ok: true }));

    const res = await GET(new Request("https://verify.tagit.network/api/warm"));

    expect(await res.text()).not.toContain(KEY);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("still refuses a caller without the cron secret when one is set, and asks nothing", async () => {
    process.env.CRON_SECRET = "cron-secret";
    answering(() => Response.json({ ok: true }));

    const res = await GET(new Request("https://verify.tagit.network/api/warm"));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
