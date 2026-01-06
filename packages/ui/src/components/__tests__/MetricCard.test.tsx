import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "../metric-card";
import { Activity } from "lucide-react";

describe("MetricCard", () => {
  it("renders title correctly", () => {
    render(<MetricCard title="Total Assets" value={100} />);
    expect(screen.getByText("Total Assets")).toBeInTheDocument();
  });

  it("renders numeric value correctly", () => {
    render(<MetricCard title="Test" value={1234} />);
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("renders string value correctly", () => {
    render(<MetricCard title="Test" value="$50,000" />);
    expect(screen.getByText("$50,000")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading is true", () => {
    render(<MetricCard title="Test" value={100} loading={true} />);
    expect(screen.queryByText("100")).not.toBeInTheDocument();
    // Should show animated skeleton
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("displays positive trend indicator correctly", () => {
    render(<MetricCard title="Test" value={100} change={15} />);
    expect(screen.getByText("+15%")).toBeInTheDocument();
  });

  it("displays negative trend indicator correctly", () => {
    render(<MetricCard title="Test" value={100} change={-10} />);
    expect(screen.getByText("-10%")).toBeInTheDocument();
  });

  it("does not show trend indicator when change is undefined", () => {
    render(<MetricCard title="Test" value={100} />);
    expect(screen.queryByText("%")).not.toBeInTheDocument();
  });

  it("does not show trend indicator when loading", () => {
    render(<MetricCard title="Test" value={100} change={15} loading={true} />);
    expect(screen.queryByText("+15%")).not.toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <MetricCard
        title="Test"
        value={100}
        icon={<Activity data-testid="test-icon" />}
      />
    );
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <MetricCard title="Test" value={100} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("handles zero value correctly", () => {
    render(<MetricCard title="Test" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles zero change correctly", () => {
    render(<MetricCard title="Test" value={100} change={0} />);
    expect(screen.getByText("+0%")).toBeInTheDocument();
  });
});
