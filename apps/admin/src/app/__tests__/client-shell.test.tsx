import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The console frame (menu, header, wallet prompt). If it is ever loaded for a
// brand account the test sees this marker.
vi.mock("next/dynamic", () => ({
  default: () =>
    function ConsoleFrame({ children }: { children: React.ReactNode }) {
      return (
        <div data-testid="console-frame">
          <span>Connect Wallet</span>
          {children}
        </div>
      );
    },
}));

import { ClientShell } from "../client-shell";

describe("ClientShell", () => {
  it("gives a brand account the page alone: no console frame, no wallet prompt", () => {
    render(
      <ClientShell tenant="biz-a">
        <p>This console is for TAG IT staff</p>
      </ClientShell>,
    );
    expect(screen.getByText("This console is for TAG IT staff")).toBeInTheDocument();
    expect(screen.queryByTestId("console-frame")).toBeNull();
    expect(screen.queryByText("Connect Wallet")).toBeNull();
  });

  it("keeps the console frame for staff", async () => {
    render(
      <ClientShell tenant={null}>
        <p>Staff page</p>
      </ClientShell>,
    );
    expect(await screen.findByTestId("console-frame")).toBeInTheDocument();
    expect(screen.getByText("Staff page")).toBeInTheDocument();
  });

  it("does not put a brand account in the frame even when a brand is being acted for", () => {
    render(
      <ClientShell tenant="biz-a" actingBrand="biz-b">
        <p>refusal</p>
      </ClientShell>,
    );
    expect(screen.queryByTestId("console-frame")).toBeNull();
  });
});
