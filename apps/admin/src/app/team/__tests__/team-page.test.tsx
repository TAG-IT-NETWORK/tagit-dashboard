import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
