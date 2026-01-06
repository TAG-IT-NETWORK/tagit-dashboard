import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoteBar } from "../vote-bar";

describe("VoteBar", () => {
  const defaultProps = {
    forVotes: 100,
    againstVotes: 50,
    abstainVotes: 25,
  };

  it("calculates and displays correct percentages", () => {
    render(<VoteBar {...defaultProps} />);

    // Total is 175, so:
    // For: 100/175 = 57.1%
    // Against: 50/175 = 28.6%
    // Abstain: 25/175 = 14.3%
    expect(screen.getByText("For 57.1%")).toBeInTheDocument();
    expect(screen.getByText("Against 28.6%")).toBeInTheDocument();
    expect(screen.getByText("Abstain 14.3%")).toBeInTheDocument();
  });

  it("displays vote counts correctly", () => {
    render(<VoteBar {...defaultProps} />);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("handles zero votes correctly", () => {
    render(<VoteBar forVotes={0} againstVotes={0} abstainVotes={0} />);

    // Should show 0.0% for all
    expect(screen.getByText("For 0.0%")).toBeInTheDocument();
    expect(screen.getByText("Against 0.0%")).toBeInTheDocument();
    expect(screen.getByText("Abstain 0.0%")).toBeInTheDocument();
  });

  it("shows quorum indicator when provided", () => {
    render(<VoteBar {...defaultProps} quorum={150} />);

    expect(screen.getByText(/Quorum:/)).toBeInTheDocument();
    expect(screen.getByText(/175 \/ 150/)).toBeInTheDocument();
  });

  it("shows quorum reached indicator when quorum is met", () => {
    render(<VoteBar {...defaultProps} quorum={150} />);

    expect(screen.getByText(/✓ Reached/)).toBeInTheDocument();
  });

  it("does not show quorum reached when quorum is not met", () => {
    render(<VoteBar {...defaultProps} quorum={200} />);

    expect(screen.queryByText(/✓ Reached/)).not.toBeInTheDocument();
  });

  it("hides labels when showLabels is false", () => {
    render(<VoteBar {...defaultProps} showLabels={false} />);

    expect(screen.queryByText("For 57.1%")).not.toBeInTheDocument();
    expect(screen.queryByText("Against 28.6%")).not.toBeInTheDocument();
  });

  it("hides quorum when showQuorum is false", () => {
    render(<VoteBar {...defaultProps} quorum={150} showQuorum={false} />);

    expect(screen.queryByText(/Quorum:/)).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <VoteBar {...defaultProps} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("renders green bar for 'for' votes", () => {
    const { container } = render(<VoteBar {...defaultProps} />);

    const greenBar = container.querySelector(".bg-green-500");
    expect(greenBar).toBeInTheDocument();
  });

  it("renders red bar for 'against' votes", () => {
    const { container } = render(<VoteBar {...defaultProps} />);

    const redBar = container.querySelector(".bg-red-500");
    expect(redBar).toBeInTheDocument();
  });

  it("renders gray bar for 'abstain' votes", () => {
    const { container } = render(<VoteBar {...defaultProps} />);

    const grayBar = container.querySelector(".bg-gray-400");
    expect(grayBar).toBeInTheDocument();
  });

  it("handles large vote numbers correctly", () => {
    render(
      <VoteBar
        forVotes={1000000}
        againstVotes={500000}
        abstainVotes={250000}
      />
    );

    // Should format numbers with commas
    expect(screen.getByText("1,000,000")).toBeInTheDocument();
    expect(screen.getByText("500,000")).toBeInTheDocument();
    expect(screen.getByText("250,000")).toBeInTheDocument();
  });

  it("calculates quorum percentage correctly", () => {
    render(<VoteBar {...defaultProps} quorum={175} />);

    // 175/175 = 100%
    expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
  });

  it("handles only 'for' votes", () => {
    render(<VoteBar forVotes={100} againstVotes={0} abstainVotes={0} />);

    expect(screen.getByText("For 100.0%")).toBeInTheDocument();
    expect(screen.getByText("Against 0.0%")).toBeInTheDocument();
    expect(screen.getByText("Abstain 0.0%")).toBeInTheDocument();
  });

  it("handles only 'against' votes", () => {
    render(<VoteBar forVotes={0} againstVotes={100} abstainVotes={0} />);

    expect(screen.getByText("For 0.0%")).toBeInTheDocument();
    expect(screen.getByText("Against 100.0%")).toBeInTheDocument();
    expect(screen.getByText("Abstain 0.0%")).toBeInTheDocument();
  });
});
