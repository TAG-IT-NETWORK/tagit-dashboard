import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PriorityBadge,
  calculatePriority,
  formatTimeOpen,
} from "../priority-badge";

describe("PriorityBadge", () => {
  describe("HIGH priority", () => {
    it("renders HIGH priority with correct label", () => {
      render(<PriorityBadge priority="HIGH" />);
      expect(screen.getByText("High")).toBeInTheDocument();
    });

    it("applies red styling for HIGH priority", () => {
      const { container } = render(<PriorityBadge priority="HIGH" />);
      expect(container.firstChild).toHaveClass("bg-red-500/10");
      expect(container.firstChild).toHaveClass("text-red-600");
    });
  });

  describe("MEDIUM priority", () => {
    it("renders MEDIUM priority with correct label", () => {
      render(<PriorityBadge priority="MEDIUM" />);
      expect(screen.getByText("Medium")).toBeInTheDocument();
    });

    it("applies yellow styling for MEDIUM priority", () => {
      const { container } = render(<PriorityBadge priority="MEDIUM" />);
      expect(container.firstChild).toHaveClass("bg-yellow-500/10");
      expect(container.firstChild).toHaveClass("text-yellow-600");
    });
  });

  describe("LOW priority", () => {
    it("renders LOW priority with correct label", () => {
      render(<PriorityBadge priority="LOW" />);
      expect(screen.getByText("Low")).toBeInTheDocument();
    });

    it("applies blue styling for LOW priority", () => {
      const { container } = render(<PriorityBadge priority="LOW" />);
      expect(container.firstChild).toHaveClass("bg-blue-500/10");
      expect(container.firstChild).toHaveClass("text-blue-600");
    });
  });

  describe("Icon display", () => {
    it("shows icon by default", () => {
      render(<PriorityBadge priority="HIGH" />);
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("hides icon when showIcon is false", () => {
      render(<PriorityBadge priority="HIGH" showIcon={false} />);
      const svg = document.querySelector("svg");
      expect(svg).not.toBeInTheDocument();
    });
  });

  it("applies custom className", () => {
    const { container } = render(
      <PriorityBadge priority="HIGH" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

describe("calculatePriority", () => {
  const NOW = 1704067200000; // Fixed timestamp for testing

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns HIGH for items older than 48 hours", () => {
    const flaggedAt = NOW - 49 * 60 * 60 * 1000; // 49 hours ago
    expect(calculatePriority(flaggedAt)).toBe("HIGH");
  });

  it("returns MEDIUM for items between 24 and 48 hours", () => {
    const flaggedAt = NOW - 36 * 60 * 60 * 1000; // 36 hours ago
    expect(calculatePriority(flaggedAt)).toBe("MEDIUM");
  });

  it("returns LOW for items less than 24 hours", () => {
    const flaggedAt = NOW - 12 * 60 * 60 * 1000; // 12 hours ago
    expect(calculatePriority(flaggedAt)).toBe("LOW");
  });

  it("handles Date objects", () => {
    const flaggedAt = new Date(NOW - 50 * 60 * 60 * 1000);
    expect(calculatePriority(flaggedAt)).toBe("HIGH");
  });

  it("returns HIGH for exactly 48 hours", () => {
    const flaggedAt = NOW - 48 * 60 * 60 * 1000 - 1; // Just over 48 hours
    expect(calculatePriority(flaggedAt)).toBe("HIGH");
  });

  it("returns MEDIUM for exactly 24 hours", () => {
    const flaggedAt = NOW - 24 * 60 * 60 * 1000 - 1; // Just over 24 hours
    expect(calculatePriority(flaggedAt)).toBe("MEDIUM");
  });

  it("returns LOW for very recent items", () => {
    const flaggedAt = NOW - 60 * 1000; // 1 minute ago
    expect(calculatePriority(flaggedAt)).toBe("LOW");
  });
});

describe("formatTimeOpen", () => {
  const NOW = 1704067200000; // Fixed timestamp

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats days and hours correctly", () => {
    const flaggedAt = NOW - 2 * 24 * 60 * 60 * 1000 - 5 * 60 * 60 * 1000; // 2d 5h ago
    expect(formatTimeOpen(flaggedAt)).toBe("2d 5h");
  });

  it("formats hours and minutes correctly", () => {
    const flaggedAt = NOW - 5 * 60 * 60 * 1000 - 30 * 60 * 1000; // 5h 30m ago
    expect(formatTimeOpen(flaggedAt)).toBe("5h 30m");
  });

  it("formats minutes correctly", () => {
    const flaggedAt = NOW - 45 * 60 * 1000; // 45m ago
    expect(formatTimeOpen(flaggedAt)).toBe("45m");
  });

  it("formats seconds correctly", () => {
    const flaggedAt = NOW - 30 * 1000; // 30s ago
    expect(formatTimeOpen(flaggedAt)).toBe("30s");
  });

  it("handles Date objects", () => {
    const flaggedAt = new Date(NOW - 3 * 24 * 60 * 60 * 1000);
    expect(formatTimeOpen(flaggedAt)).toBe("3d 0h");
  });

  it("formats zero days correctly", () => {
    const flaggedAt = NOW - 12 * 60 * 60 * 1000; // 12 hours ago
    expect(formatTimeOpen(flaggedAt)).toBe("12h 0m");
  });

  it("formats exactly 1 day correctly", () => {
    const flaggedAt = NOW - 24 * 60 * 60 * 1000; // 24 hours ago
    expect(formatTimeOpen(flaggedAt)).toBe("1d 0h");
  });
});
