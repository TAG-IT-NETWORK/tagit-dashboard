import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import TeamPage from "../page";

/**
 * The owner row is shown locked: no remove button and a fixed role. The lock
 * itself is on the server (team-proxy + services); this only keeps the page
 * from offering a button that would be refused.
 */

const ROSTER = [
  { email: "info@tagit.network", role: "admin", businessId: null, protected: true },
  { email: "second@tagit.network", role: "admin", businessId: null, protected: false },
];

describe("/team owner row", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true, users: ROSTER }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("offers no remove button and a fixed role for the owner", async () => {
    render(<TeamPage />);
    await screen.findByText("info@tagit.network");

    expect(screen.queryByRole("button", { name: "Remove info@tagit.network" })).toBeNull();
    expect(
      (screen.getByLabelText("Role for info@tagit.network") as HTMLSelectElement).disabled,
    ).toBe(true);
    expect(screen.getByText("Owner")).toBeTruthy();
  });

  it("keeps both controls for everyone else", async () => {
    render(<TeamPage />);
    await screen.findByText("second@tagit.network");

    expect(screen.getByRole("button", { name: "Remove second@tagit.network" })).toBeTruthy();
    expect(
      (screen.getByLabelText("Role for second@tagit.network") as HTMLSelectElement).disabled,
    ).toBe(false);
    expect(screen.getAllByText("Owner")).toHaveLength(1);
  });
});

/**
 * TAP-T16: nobody is added before the page knows where they would land. A
 * request that names no brand makes a PLATFORM-WIDE user when a platform
 * admin sends it, so "the brand list did not load" must never look like
 * "you are a brand admin".
 */
describe("/team: where a new member lands", () => {
  type Answer = { status: number; body: unknown } | "reject" | "hang";
  const calls: Array<{ url: string; body: unknown }> = [];

  function serve(brandList: Answer, acting: Answer) {
    calls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "POST") {
          calls.push({ url, body: JSON.parse(String(init.body)) });
          return new Response(JSON.stringify({ ok: true }), { status: 201 });
        }
        const answer =
          url === "/api/brand-proxy"
            ? brandList
            : url === "/api/brand-proxy/acting"
              ? acting
              : null;
        if (answer === null) return new Response(JSON.stringify({ ok: true, users: ROSTER }));
        if (answer === "reject") throw new Error("offline");
        if (answer === "hang") return new Promise<Response>(() => undefined);
        return new Response(JSON.stringify(answer.body), { status: answer.status });
      }),
    );
  }
  const BRANDS = {
    status: 200,
    body: { ok: true, businesses: [{ id: "aurora", name: "Aurora" }] },
  };
  const NOT_ACTING = { status: 200, body: { ok: true, acting: null } };
  const FORBIDDEN = { status: 403, body: { ok: false, error: "FORBIDDEN" } };
  const addButton = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
  const typeEmail = () =>
    fireEvent.change(screen.getByLabelText("Google email"), { target: { value: "new@x.example" } });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("stays off while the brand list is still loading", async () => {
    serve("hang", "hang");
    render(<TeamPage />);
    await screen.findByText("info@tagit.network");
    typeEmail();
    expect(addButton().disabled).toBe(true);
    expect(screen.queryByText("Your brand")).toBeNull();
  });

  it.each([
    ["the brand list fails", { status: 502, body: { ok: false } }, NOT_ACTING],
    ["the brand list cannot be reached", "reject", NOT_ACTING],
    ["the brand list is not a list", { status: 200, body: { ok: true } }, NOT_ACTING],
    ["the switch cannot be read", BRANDS, { status: 502, body: { ok: false } }],
    ["the switch answers nonsense", BRANDS, { status: 200, body: { ok: true, acting: 7 } }],
    ["only one of the two is refused", BRANDS, FORBIDDEN],
  ] as Array<[string, Answer, Answer]>)(
    "stays off, and says why, when %s",
    async (_label, list, acting) => {
      serve(list, acting);
      render(<TeamPage />);
      await screen.findByText(/Could not load the brands, so nobody can be added yet/);
      typeEmail();
      expect(addButton().disabled).toBe(true);
      expect(screen.queryByText("Your brand")).toBeNull();
      fireEvent.submit(addButton().closest("form")!);
      expect(calls).toEqual([]);
    },
  );

  it("a platform admin picks the brand, and the request names it", async () => {
    serve(BRANDS, NOT_ACTING);
    render(<TeamPage />);
    const picker = (await screen.findByLabelText("Brand")) as HTMLSelectElement;
    await waitFor(() => expect(picker.tagName).toBe("SELECT"));
    typeEmail();
    fireEvent.change(picker, { target: { value: "aurora" } });
    fireEvent.click(addButton());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body).toEqual({
      email: "new@x.example",
      role: "viewer",
      businessId: "aurora",
    });
  });

  it("a brand admin (both brand routes refused) adds to their own brand, naming none", async () => {
    serve(FORBIDDEN, FORBIDDEN);
    render(<TeamPage />);
    await screen.findByText("Your brand");
    typeEmail();
    expect(addButton().disabled).toBe(false);
    fireEvent.click(addButton());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body).toEqual({ email: "new@x.example", role: "viewer" });
  });

  it("a platform admin creating for a brand sees that brand, fixed", async () => {
    serve(BRANDS, { status: 200, body: { ok: true, acting: "aurora" } });
    render(<TeamPage />);
    await screen.findByText("aurora");
    expect(screen.queryByRole("combobox", { name: "Brand" })).toBeNull();
    typeEmail();
    fireEvent.click(addButton());
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body).toEqual({ email: "new@x.example", role: "viewer" });
  });
});
