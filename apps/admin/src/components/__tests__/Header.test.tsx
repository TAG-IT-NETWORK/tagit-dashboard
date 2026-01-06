import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "../header";

// Mock the useCurrentUser hook
const mockUseCurrentUser = vi.fn();
vi.mock("@tagit/auth", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

// Mock the UI components
vi.mock("@tagit/ui", () => ({
  ConnectButton: () => <button data-testid="connect-button">Connect</button>,
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

describe("Header", () => {
  beforeEach(() => {
    mockUseCurrentUser.mockReturnValue({
      badges: [],
      isConnected: false,
      isLoading: false,
    });
  });

  it("renders the Admin Console title", () => {
    render(<Header />);
    expect(screen.getByText("Admin Console")).toBeInTheDocument();
  });

  it("renders the connect button", () => {
    render(<Header />);
    expect(screen.getByTestId("connect-button")).toBeInTheDocument();
  });

  it("renders the notification bell", () => {
    render(<Header />);
    const bellButton = screen.getByRole("button", { name: "" });
    expect(bellButton).toBeInTheDocument();
  });

  it("shows notification indicator dot", () => {
    const { container } = render(<Header />);
    const notificationDot = container.querySelector(".bg-destructive");
    expect(notificationDot).toBeInTheDocument();
  });

  it("does not show badges when not connected", () => {
    mockUseCurrentUser.mockReturnValue({
      badges: [{ id: 1, name: "Admin" }],
      isConnected: false,
      isLoading: false,
    });

    render(<Header />);
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("does not show badges while loading", () => {
    mockUseCurrentUser.mockReturnValue({
      badges: [{ id: 1, name: "Admin" }],
      isConnected: true,
      isLoading: true,
    });

    render(<Header />);
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("shows badges when connected and loaded", () => {
    mockUseCurrentUser.mockReturnValue({
      badges: [
        { id: 1, name: "Admin" },
        { id: 2, name: "Validator" },
      ],
      isConnected: true,
      isLoading: false,
    });

    render(<Header />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Validator")).toBeInTheDocument();
  });

  it("does not show badges section when badges array is empty", () => {
    mockUseCurrentUser.mockReturnValue({
      badges: [],
      isConnected: true,
      isLoading: false,
    });

    render(<Header />);
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("renders badges with secondary variant", () => {
    mockUseCurrentUser.mockReturnValue({
      badges: [{ id: 1, name: "Admin" }],
      isConnected: true,
      isLoading: false,
    });

    render(<Header />);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveAttribute("data-variant", "secondary");
  });

  it("renders multiple badges correctly", () => {
    mockUseCurrentUser.mockReturnValue({
      badges: [
        { id: 1, name: "Admin" },
        { id: 2, name: "Validator" },
        { id: 3, name: "Council" },
      ],
      isConnected: true,
      isLoading: false,
    });

    render(<Header />);
    const badges = screen.getAllByTestId("badge");
    expect(badges).toHaveLength(3);
  });

  it("applies correct header styling", () => {
    const { container } = render(<Header />);
    const header = container.querySelector("header");
    expect(header).toHaveClass("flex");
    expect(header).toHaveClass("items-center");
    expect(header).toHaveClass("justify-between");
  });
});
