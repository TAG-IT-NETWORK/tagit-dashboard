import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ActingBrandBanner } from "../acting-brand-banner";

/** TAP-T16: the banner a platform admin sees while creating for a brand. */

describe("ActingBrandBanner", () => {
  const reload = vi.fn();
  beforeEach(() => {
    reload.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("names the brand and says what being in this mode means", () => {
    render(<ActingBrandBanner brandId="aurora" />);
    const banner = screen.getByRole("status");
    expect(banner.getAttribute("data-acting-brand")).toBe("aurora");
    expect(banner.textContent).toContain("Creating for brand aurora");
    expect(banner.textContent).toContain("what you make belongs to it");
  });

  it("Stop clears the choice on the server, then loads the page afresh", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, acting: null })));
    vi.stubGlobal("fetch", fetchMock);
    render(<ActingBrandBanner brandId="aurora" />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/brand-proxy/acting");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ businessId: null });
  });

  it("says so and stays when it could not stop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 502 })),
    );
    render(<ActingBrandBanner brandId="aurora" />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await screen.findByText("Could not stop. Try again.");
    expect(reload).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Stop" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
