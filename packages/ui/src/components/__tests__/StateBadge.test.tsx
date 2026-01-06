import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StateBadge, getStateLabel, getStateColor } from "../state-badge";

describe("StateBadge", () => {
  it("renders Minted state (0) correctly", () => {
    render(<StateBadge state={0} />);
    expect(screen.getByText("Minted")).toBeInTheDocument();
  });

  it("renders Bound state (1) correctly", () => {
    render(<StateBadge state={1} />);
    expect(screen.getByText("Bound")).toBeInTheDocument();
  });

  it("renders Activated state (2) correctly", () => {
    render(<StateBadge state={2} />);
    expect(screen.getByText("Activated")).toBeInTheDocument();
  });

  it("renders Claimed state (3) correctly", () => {
    render(<StateBadge state={3} />);
    expect(screen.getByText("Claimed")).toBeInTheDocument();
  });

  it("renders Flagged state (4) correctly", () => {
    render(<StateBadge state={4} />);
    expect(screen.getByText("Flagged")).toBeInTheDocument();
  });

  it("renders Recycled state (5) correctly", () => {
    render(<StateBadge state={5} />);
    expect(screen.getByText("Recycled")).toBeInTheDocument();
  });

  it("handles unknown state gracefully", () => {
    render(<StateBadge state={99} />);
    expect(screen.getByText("Unknown (99)")).toBeInTheDocument();
  });

  it("handles negative state gracefully", () => {
    render(<StateBadge state={-1} />);
    expect(screen.getByText("Unknown (-1)")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<StateBadge state={0} className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("applies correct color class for Minted state", () => {
    const { container } = render(<StateBadge state={0} />);
    expect(container.firstChild).toHaveClass("bg-gray-500/10");
  });

  it("applies correct color class for Flagged state", () => {
    const { container } = render(<StateBadge state={4} />);
    expect(container.firstChild).toHaveClass("bg-red-500/10");
  });
});

describe("getStateLabel", () => {
  it("returns correct label for each state", () => {
    expect(getStateLabel(0)).toBe("Minted");
    expect(getStateLabel(1)).toBe("Bound");
    expect(getStateLabel(2)).toBe("Activated");
    expect(getStateLabel(3)).toBe("Claimed");
    expect(getStateLabel(4)).toBe("Flagged");
    expect(getStateLabel(5)).toBe("Recycled");
  });

  it("returns Unknown for invalid states", () => {
    expect(getStateLabel(99)).toBe("Unknown (99)");
    expect(getStateLabel(-1)).toBe("Unknown (-1)");
  });
});

describe("getStateColor", () => {
  it("returns correct color for each state", () => {
    expect(getStateColor(0)).toBe("#6b7280"); // gray
    expect(getStateColor(1)).toBe("#3b82f6"); // blue
    expect(getStateColor(2)).toBe("#22c55e"); // green
    expect(getStateColor(3)).toBe("#a855f7"); // purple
    expect(getStateColor(4)).toBe("#ef4444"); // red
    expect(getStateColor(5)).toBe("#f97316"); // orange
  });

  it("returns default gray for unknown states", () => {
    expect(getStateColor(99)).toBe("#6b7280");
  });
});
