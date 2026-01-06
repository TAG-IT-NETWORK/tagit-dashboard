import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResolutionBadge, getResolutionLabel } from "../resolution-badge";

describe("ResolutionBadge", () => {
  describe("CLEAR resolution", () => {
    it("renders CLEAR resolution with correct label", () => {
      render(<ResolutionBadge resolution="CLEAR" />);
      expect(screen.getByText("Cleared")).toBeInTheDocument();
    });

    it("renders CLEAR resolution from number (0)", () => {
      render(<ResolutionBadge resolution={0} />);
      expect(screen.getByText("Cleared")).toBeInTheDocument();
    });

    it("applies green styling for CLEAR", () => {
      const { container } = render(<ResolutionBadge resolution="CLEAR" />);
      expect(container.firstChild).toHaveClass("bg-green-500/10");
      expect(container.firstChild).toHaveClass("text-green-600");
    });
  });

  describe("QUARANTINE resolution", () => {
    it("renders QUARANTINE resolution with correct label", () => {
      render(<ResolutionBadge resolution="QUARANTINE" />);
      expect(screen.getByText("Quarantined")).toBeInTheDocument();
    });

    it("renders QUARANTINE resolution from number (1)", () => {
      render(<ResolutionBadge resolution={1} />);
      expect(screen.getByText("Quarantined")).toBeInTheDocument();
    });

    it("applies yellow styling for QUARANTINE", () => {
      const { container } = render(<ResolutionBadge resolution="QUARANTINE" />);
      expect(container.firstChild).toHaveClass("bg-yellow-500/10");
      expect(container.firstChild).toHaveClass("text-yellow-600");
    });
  });

  describe("DECOMMISSION resolution", () => {
    it("renders DECOMMISSION resolution with correct label", () => {
      render(<ResolutionBadge resolution="DECOMMISSION" />);
      expect(screen.getByText("Decommissioned")).toBeInTheDocument();
    });

    it("renders DECOMMISSION resolution from number (2)", () => {
      render(<ResolutionBadge resolution={2} />);
      expect(screen.getByText("Decommissioned")).toBeInTheDocument();
    });

    it("applies red styling for DECOMMISSION", () => {
      const { container } = render(<ResolutionBadge resolution="DECOMMISSION" />);
      expect(container.firstChild).toHaveClass("bg-red-500/10");
      expect(container.firstChild).toHaveClass("text-red-600");
    });
  });

  describe("Icon display", () => {
    it("shows icon by default", () => {
      render(<ResolutionBadge resolution="CLEAR" />);
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("hides icon when showIcon is false", () => {
      render(<ResolutionBadge resolution="CLEAR" showIcon={false} />);
      const svg = document.querySelector("svg");
      expect(svg).not.toBeInTheDocument();
    });
  });

  it("applies custom className", () => {
    const { container } = render(
      <ResolutionBadge resolution="CLEAR" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

describe("getResolutionLabel", () => {
  it("returns correct label for string resolutions", () => {
    expect(getResolutionLabel("CLEAR")).toBe("Cleared");
    expect(getResolutionLabel("QUARANTINE")).toBe("Quarantined");
    expect(getResolutionLabel("DECOMMISSION")).toBe("Decommissioned");
  });

  it("returns correct label for numeric resolutions", () => {
    expect(getResolutionLabel(0)).toBe("Cleared");
    expect(getResolutionLabel(1)).toBe("Quarantined");
    expect(getResolutionLabel(2)).toBe("Decommissioned");
  });
});
