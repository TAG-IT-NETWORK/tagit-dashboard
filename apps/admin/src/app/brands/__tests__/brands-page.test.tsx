import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import BrandsPage from "../page";

/**
 * TAP-T16: the Brands page when something goes wrong. A list that could not
 * be loaded is not an empty list, a request that never left frees the
 * buttons, and a card never keeps text that is older than its record.
 */

const AURORA = {
  id: "aurora",
  name: "Aurora",
  logoUrl: null,
  treasuryWallet: null,
  defaultMintRecipient: null,
};
const WALLET = "0x52908400098527886E0F7030069857D2E4169EE7";

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response> | "reject";
function serve(handler: Handler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const answer = handler(String(input), init);
    if (answer === "reject") throw new TypeError("Failed to fetch");
    return answer;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const base =
  (over: Partial<Record<"brands" | "free" | "acting", Response | "reject">> = {}) =>
  (url: string) => {
    if (url === "/api/brand-proxy") return over.brands ?? json({ ok: true, businesses: [AURORA] });
    if (url === "/api/brand-proxy/unassigned") {
      return (
        over.free ??
        json({
          ok: true,
          templates: [{ id: "tpl_FREE", name: "Day Cream", sku: null, status: "published" }],
        })
      );
    }
    return over.acting ?? json({ ok: true, acting: null });
  };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/brands when a list cannot be loaded", () => {
  it.each([
    ["answers an error", () => json({ ok: false, error: "UPSTREAM_FAILED" }, 502)],
    ["cannot be reached", () => "reject" as const],
    ["answers something that is not a list", () => json({ ok: true })],
  ])(
    "says the no-brand products could not be loaded when that request %s",
    async (_label, free) => {
      serve(
        (url, init) => (url === "/api/brand-proxy/unassigned" ? free() : base()(url)) as Response,
      );
      render(<BrandsPage />);
      const card = (await screen.findByText("Give products that have no brand")).closest(
        "[data-brand]",
      ) as HTMLElement;
      expect(within(card).getByRole("alert").textContent).toContain(
        "Could not load the products that have no brand",
      );
      // Never the sentence that means "there are none".
      expect(screen.queryByText("Every product already has a brand.")).toBeNull();
    },
  );

  it("says 'every product has a brand' only for a real empty list", async () => {
    serve(base({ free: json({ ok: true, templates: [] }) }));
    render(<BrandsPage />);
    await screen.findByText("Every product already has a brand.");
  });

  it("says the brands could not be reached, in a sentence, when the request never left", async () => {
    serve(() => "reject");
    render(<BrandsPage />);
    const alert = await screen.findByText(
      /Could not reach the brand service\. Check your connection/,
    );
    expect(alert.getAttribute("role")).toBe("alert");
  });
});

describe("/brands when a request never comes back", () => {
  it("frees the buttons and says so, for create, save and the switch", async () => {
    let offline = false;
    serve((url, init) => (offline && init?.method ? "reject" : (base()(url) as Response)));
    render(<BrandsPage />);
    await screen.findByText("Give products that have no brand");
    offline = true;

    fireEvent.change(screen.getAllByLabelText("Brand name")[0]!, { target: { value: "Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText(/Check your connection and try again/);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );

    const act = screen.getByRole("button", { name: "Create for this brand" }) as HTMLButtonElement;
    fireEvent.click(act);
    await waitFor(() => expect(act.disabled).toBe(false));

    fireEvent.change(screen.getByLabelText("Wallet that receives the brand's sales"), {
      target: { value: WALLET },
    });
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    fireEvent.click(save);
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });
});

describe("/brands: a card never keeps text older than its record", () => {
  it("starts again from the record when the record changed", async () => {
    let record = { ...AURORA };
    serve((url) =>
      url === "/api/brand-proxy"
        ? json({ ok: true, businesses: [record] })
        : (base()(url) as Response),
    );
    render(<BrandsPage />);
    const field = () =>
      screen.getByLabelText("Wallet that receives the brand's sales") as HTMLInputElement;
    await screen.findByText("Give products that have no brand");

    // Half-typed here; meanwhile the record is changed elsewhere.
    fireEvent.change(field(), { target: { value: "0x1111" } });
    record = { ...AURORA, name: "Aurora Renamed", treasuryWallet: WALLET };
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(field().value).toBe(WALLET));
    expect((screen.getAllByLabelText("Brand name")[1] as HTMLInputElement).value).toBe(
      "Aurora Renamed",
    );
    // Nothing differs from the record now, so there is nothing to save over it.
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps what is typed when a refresh brings the same record", async () => {
    serve(base());
    render(<BrandsPage />);
    const field = () =>
      screen.getByLabelText("Wallet that receives the brand's sales") as HTMLInputElement;
    await screen.findByText("Give products that have no brand");
    fireEvent.change(field(), { target: { value: "0x1111" } });
    const fetchMock = vi.mocked(fetch);
    const before = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 3));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    expect(field().value).toBe("0x1111");
  });
});
