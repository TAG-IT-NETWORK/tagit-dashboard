import { test, expect } from "@playwright/test";

/**
 * TAP-T01 guard: this app has no bind routes.
 *
 * Tags are attached at the binding station in the TAG IT console, behind a
 * signed-in session and a real chip tap. The business app holds no service
 * credentials and must not relay binds.
 *
 * The request bodies are deliberately empty, so a red run of this suite can
 * never cause a real bind.
 */
test.describe("TAP-T01 — the business app has no bind routes", () => {
  test("POST /api/bind is not routable", async ({ request }) => {
    const res = await request.post("/api/bind", { data: {} });
    expect(res.status()).toBe(404);
  });

  test("GET /api/bind/status is not routable", async ({ request }) => {
    const res = await request.get("/api/bind/status");
    expect(res.status()).toBe(404);
  });

  test("no HTTP method reaches a bind handler", async ({ request }) => {
    for (const method of ["PUT", "PATCH", "DELETE"] as const) {
      const res = await request.fetch("/api/bind", { method, data: {} });
      expect(res.status(), `${method} /api/bind`).toBe(404);
    }
  });
});
