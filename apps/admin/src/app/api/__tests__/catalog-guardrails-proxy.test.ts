// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TAP-T19: what the catalog proxies do with the cream-run guardrails.
 *   batches   — the proxy refuses a batch over 100 items itself, in the same
 *               words as tagit-services, and forwards nothing
 *   the rest  — refusals and reasons that tagit-services writes (a template
 *               that is not published or not complete, why a mint failed)
 *               reach the browser as they were sent: status, sentence, list
 */

const TEST_KEY = "test-services-key-do-not-leak";
const TPL = "tpl_01TESTTEMPLATE0000000000000";
const BAT = "bat_01TESTBATCH000000000000000";
const SIZE_ADVICE = "A batch can hold at most 100 items. Split a larger run into several batches.";

const authState: { session: unknown } = { session: null };
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => authState.session),
}));

type Handler = (req: Request, props: { params: Promise<{ id: string }> }) => Promise<Response>;

async function call(
  route: string,
  method: "GET" | "POST",
  body?: unknown,
  params?: { id: string },
): Promise<Response> {
  vi.resetModules();
  const mod = (await import(route)) as Record<string, Handler>;
  return mod[method]!(
    new Request("http://admin.local/api/catalog-proxy", {
      method,
      ...(body !== undefined
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    }),
    { params: Promise.resolve(params ?? { id: "" }) },
  );
}

describe("catalog proxies and the cream-run guardrails (TAP-T19)", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;
  const upstreamAnswers = (body: unknown, status: number) => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetchMock);
  };

  beforeEach(() => {
    process.env.SERVICES_API_KEY = TEST_KEY;
    process.env.RELAYER_API_KEY = "test-relayer-key-do-not-leak";
    process.env.SERVICES_URL = "https://services.test";
    authState.session = {
      user: { email: "ops@tagit.network", role: "admin", businessId: null },
    };
    upstreamAnswers({ ok: true, batch: {} }, 201);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  describe("batch size", () => {
    it("refuses 101 items with what to do, and forwards nothing", async () => {
      const res = await call("../catalog-proxy/batches/route", "POST", {
        templateId: TPL,
        quantity: 101,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: SIZE_ADVICE });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("forwards exactly 100", async () => {
      const res = await call("../catalog-proxy/batches/route", "POST", {
        templateId: TPL,
        quantity: 100,
      });
      expect(res.status).toBe(201);
      expect(JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))).toEqual({
        templateId: TPL,
        quantity: 100,
      });
    });

    it("still refuses what is not a count at all", async () => {
      for (const quantity of [0, -1, 2.5, "20"]) {
        const res = await call("../catalog-proxy/batches/route", "POST", {
          templateId: TPL,
          quantity,
        });
        expect(res.status, String(quantity)).toBe(400);
        expect((await res.json()).error, String(quantity)).toBe(
          "quantity must be a whole number, 1 or more",
        );
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("what tagit-services says reaches the browser unchanged", () => {
    it("a batch refused because the template was never published", async () => {
      const refusal = {
        error: "TEMPLATE_NOT_PUBLISHED",
        message: "Publish the template first. Items can only be minted from a published template.",
      };
      upstreamAnswers(refusal, 409);
      const res = await call("../catalog-proxy/batches/route", "POST", {
        templateId: TPL,
        quantity: 5,
      });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual(refusal);
    });

    it("a publish refused for missing parts, with the list", async () => {
      const refusal = {
        error: "TEMPLATE_INCOMPLETE",
        message:
          "This template cannot be published yet. Still missing: brand and a photo. Add what is missing, then publish again.",
        details: { missing: ["brand", "photo"] },
      };
      upstreamAnswers(refusal, 400);
      const res = await call("../catalog-proxy/templates/[id]/publish/route", "POST", undefined, {
        id: TPL,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(refusal);
    });

    it("a mint refused before it starts", async () => {
      const refusal = {
        error: "BATCH_TOO_LARGE",
        message: `This batch has 180 items. ${SIZE_ADVICE}`,
      };
      upstreamAnswers(refusal, 409);
      const res = await call(
        "../catalog-proxy/batches/[id]/execute/route",
        "POST",
        { to: "0x8aE1E82C00145d5e08b8E63DF35cA455F0aabe23" },
        { id: BAT },
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual(refusal);
    });

    it("the reason a mint failed, with the batch's status", async () => {
      const status = {
        ok: true,
        batch: { id: BAT, state: "mint_failed" },
        progress: { expected: 5, minted: 0, tokens: [] },
        failure: {
          code: "RELAYER_OUT_OF_FUNDS",
          message:
            "The TAG IT wallet that mints has run out of funds for network fees, so nothing was minted. Contact TAG IT support, then retry.",
          at: "2026-11-18T10:00:00.000Z",
        },
      };
      upstreamAnswers(status, 200);
      const res = await call("../catalog-proxy/batches/[id]/route", "GET", undefined, { id: BAT });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(status);
    });
  });
});
