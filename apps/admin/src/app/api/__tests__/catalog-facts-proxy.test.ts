// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TAP-T09: the catalog proxies carry product facts to tagit-services.
 *   templates — `facts` is one more whitelisted body key
 *   batches   — `facts` rides in the JSON body on the quantity path and in
 *               the query string on the CSV path
 * The proxy reads the batch facts itself first, so a malformed value is
 * refused here and never forwarded.
 */

const TEST_KEY = "test-services-key-do-not-leak";
const TPL = "tpl_01TESTTEMPLATE0000000000000";

const authState: { session: unknown } = { session: null };
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => authState.session),
}));

type FetchCall = { url: string; init: RequestInit };

function upstreamCalls(fetchMock: ReturnType<typeof vi.fn>): FetchCall[] {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    init: (init ?? {}) as RequestInit,
  }));
}

async function call(route: string, method: "POST" | "PUT", body: unknown, params?: { id: string }) {
  vi.resetModules();
  const mod = (await import(route)) as Record<
    string,
    (req: Request, props: { params: Promise<{ id: string }> }) => Promise<Response>
  >;
  return mod[method]!(
    new Request("http://admin.local/api/catalog-proxy", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve(params ?? { id: "" }) },
  );
}

describe("catalog proxies carry product facts (TAP-T09)", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SERVICES_API_KEY = TEST_KEY;
    process.env.SERVICES_URL = "https://services.test";
    authState.session = {
      user: { email: "ops@tagit.network", role: "admin", businessId: null },
    };
    fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, batch: {}, template: {} }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  describe("templates", () => {
    const FACTS = { size: "50 ml", ingredients: "Aqua, Glycerin", useWithinMonths: 12 };

    it("PUT forwards facts with the other fields", async () => {
      const res = await call(
        "../catalog-proxy/templates/[id]/route",
        "PUT",
        { name: "Night Cream", facts: FACTS, notAField: "dropped" },
        { id: TPL },
      );

      expect(res.status).toBe(201);
      const [sent] = upstreamCalls(fetchMock);
      expect(sent!.url).toBe(`https://services.test/api/v1/admin/templates/${TPL}`);
      expect(JSON.parse(String(sent!.init.body))).toEqual({ name: "Night Cream", facts: FACTS });
    });

    it("PUT forwards facts: null, which clears them upstream", async () => {
      await call("../catalog-proxy/templates/[id]/route", "PUT", { facts: null }, { id: TPL });
      expect(JSON.parse(String(upstreamCalls(fetchMock)[0]!.init.body))).toEqual({ facts: null });
    });

    it("POST forwards facts on create", async () => {
      await call("../catalog-proxy/templates/route", "POST", { name: "Night Cream", facts: FACTS });
      expect(JSON.parse(String(upstreamCalls(fetchMock)[0]!.init.body))).toEqual({
        name: "Night Cream",
        facts: FACTS,
      });
    });

    it("a viewer cannot write facts", async () => {
      authState.session = { user: { email: "v@tagit.network", role: "viewer", businessId: null } };
      const res = await call(
        "../catalog-proxy/templates/[id]/route",
        "PUT",
        { facts: FACTS },
        { id: TPL },
      );
      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("batches", () => {
    const FACTS = { lot: "L2406A", madeOn: "2026-06-01", bestBefore: "2028-06-01" };

    it("quantity path: facts go in the JSON body", async () => {
      const res = await call("../catalog-proxy/batches/route", "POST", {
        templateId: TPL,
        quantity: 20,
        facts: { ...FACTS, lot: "  L2406A " },
      });

      expect(res.status).toBe(201);
      const [sent] = upstreamCalls(fetchMock);
      expect(sent!.url).toBe("https://services.test/api/v1/admin/batches");
      expect(JSON.parse(String(sent!.init.body))).toEqual({
        templateId: TPL,
        quantity: 20,
        facts: FACTS,
      });
    });

    it("CSV path: facts go in the query string, next to the template id", async () => {
      const csv = "serial\nSN-1\nSN-2\n";
      await call("../catalog-proxy/batches/route", "POST", { templateId: TPL, csv, facts: FACTS });

      const [sent] = upstreamCalls(fetchMock);
      const url = new URL(sent!.url);
      expect(url.pathname).toBe("/api/v1/admin/batches");
      expect(Object.fromEntries(url.searchParams)).toEqual({ templateId: TPL, ...FACTS });
      expect(sent!.init.body).toBe(csv);
      expect((sent!.init.headers as Record<string, string>)["content-type"]).toBe("text/csv");
    });

    it("escapes a lot number that would otherwise break out of the query string", async () => {
      await call("../catalog-proxy/batches/route", "POST", {
        templateId: TPL,
        csv: "serial\nSN-1\n",
        facts: { lot: "A&templateId=tpl_OTHER#x y" },
      });
      const url = new URL(upstreamCalls(fetchMock)[0]!.url);
      expect(url.searchParams.getAll("templateId")).toEqual([TPL]);
      expect(url.searchParams.get("lot")).toBe("A&templateId=tpl_OTHER#x y");
    });

    it("without facts the upstream request is exactly what it was before", async () => {
      await call("../catalog-proxy/batches/route", "POST", { templateId: TPL, quantity: 5 });
      await call("../catalog-proxy/batches/route", "POST", {
        templateId: TPL,
        csv: "serial\nSN-1\n",
        facts: { lot: "", madeOn: null },
      });

      const calls = upstreamCalls(fetchMock);
      expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ templateId: TPL, quantity: 5 });
      expect(calls[1]!.url).toBe(`https://services.test/api/v1/admin/batches?templateId=${TPL}`);
    });

    it("refuses malformed facts itself and forwards nothing", async () => {
      const bad: unknown[] = [
        { madeOn: "2026-02-30" },
        { madeOn: "2026-06-01", bestBefore: "2026-05-31" },
        { lot: "L".repeat(61) },
        { lot: ["L1", "L2"] },
        { size: "50 ml" },
        "L2406A",
      ];
      for (const facts of bad) {
        const res = await call("../catalog-proxy/batches/route", "POST", {
          templateId: TPL,
          quantity: 5,
          facts,
        });
        expect(res.status, JSON.stringify(facts).slice(0, 50)).toBe(400);
        expect(((await res.json()) as { error: string }).error).toMatch(/facts/);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("a viewer cannot create a batch, with or without facts", async () => {
      authState.session = { user: { email: "v@tagit.network", role: "viewer", businessId: null } };
      const res = await call("../catalog-proxy/batches/route", "POST", {
        templateId: TPL,
        quantity: 5,
        facts: FACTS,
      });
      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
