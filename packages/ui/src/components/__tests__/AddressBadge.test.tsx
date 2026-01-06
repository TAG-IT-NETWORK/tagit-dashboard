import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddressBadge } from "../address-badge";

const mockAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// Mock clipboard API globally
const mockWriteText = vi.fn().mockResolvedValue(undefined);

beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: mockWriteText,
      readText: vi.fn().mockResolvedValue(""),
    },
    configurable: true,
  });
});

describe("AddressBadge", () => {
  it("renders address with truncation by default", () => {
    render(<AddressBadge address={mockAddress} />);
    expect(screen.getByText("0xf39F...2266")).toBeInTheDocument();
  });

  it("renders full address when truncate is false", () => {
    render(<AddressBadge address={mockAddress} truncate={false} />);
    expect(screen.getByText(mockAddress)).toBeInTheDocument();
  });

  it("shows copy button by default", () => {
    render(<AddressBadge address={mockAddress} />);
    const copyButton = screen.getByTitle("Copy address");
    expect(copyButton).toBeInTheDocument();
  });

  it("hides copy button when showCopy is false", () => {
    render(<AddressBadge address={mockAddress} showCopy={false} />);
    expect(screen.queryByTitle("Copy address")).not.toBeInTheDocument();
  });

  it("copy button can be clicked", async () => {
    const user = userEvent.setup();
    render(<AddressBadge address={mockAddress} />);

    const copyButton = screen.getByTitle("Copy address");
    // Just verify the button can be clicked without throwing
    await user.click(copyButton);
    expect(copyButton).toBeInTheDocument();
  });

  it("shows check icon after successful copy", async () => {
    mockWriteText.mockClear();
    const user = userEvent.setup();
    render(<AddressBadge address={mockAddress} />);

    const copyButton = screen.getByTitle("Copy address");
    await user.click(copyButton);

    // Check icon should appear after copy
    await waitFor(() => {
      const checkIcon = document.querySelector(".text-green-500");
      expect(checkIcon).toBeInTheDocument();
    });
  });

  it("shows Blockscout link by default", () => {
    render(<AddressBadge address={mockAddress} />);
    const link = screen.getByTitle("View on Blockscout");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      `https://optimism-sepolia.blockscout.com/address/${mockAddress}`
    );
  });

  it("hides Blockscout link when showEtherscan is false", () => {
    render(<AddressBadge address={mockAddress} showEtherscan={false} />);
    expect(screen.queryByTitle("View on Blockscout")).not.toBeInTheDocument();
  });

  it("Blockscout link opens in new tab", () => {
    render(<AddressBadge address={mockAddress} />);
    const link = screen.getByTitle("View on Blockscout");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("applies custom className", () => {
    const { container } = render(
      <AddressBadge address={mockAddress} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("handles short addresses without truncation", () => {
    const shortAddress = "0x1234";
    render(<AddressBadge address={shortAddress} />);
    expect(screen.getByText(shortAddress)).toBeInTheDocument();
  });

  it("renders address in monospace font", () => {
    render(<AddressBadge address={mockAddress} />);
    const codeElement = screen.getByText("0xf39F...2266");
    expect(codeElement.tagName.toLowerCase()).toBe("code");
    expect(codeElement).toHaveClass("font-mono");
  });
});
