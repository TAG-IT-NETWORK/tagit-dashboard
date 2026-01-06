import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "../sidebar";

// Mock next/navigation
const mockPathname = vi.fn().mockReturnValue("/dashboard");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    title,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    title?: string;
  }) => (
    <a href={href} className={className} title={title}>
      {children}
    </a>
  ),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/dashboard");
  });

  it("renders the sidebar with navigation items", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Badges")).toBeInTheDocument();
    expect(screen.getByText("Capabilities")).toBeInTheDocument();
    expect(screen.getByText("Resolve")).toBeInTheDocument();
    expect(screen.getByText("Governance")).toBeInTheDocument();
    expect(screen.getByText("Treasury")).toBeInTheDocument();
  });

  it("renders the TAG IT Admin logo", () => {
    render(<Sidebar />);
    expect(screen.getByText("TAG IT Admin")).toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders navigation links with correct hrefs", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByText("Assets").closest("a")).toHaveAttribute(
      "href",
      "/assets"
    );
    expect(screen.getByText("Users").closest("a")).toHaveAttribute(
      "href",
      "/users"
    );
    expect(screen.getByText("Governance").closest("a")).toHaveAttribute(
      "href",
      "/governance"
    );
  });

  it("highlights active navigation item based on pathname", () => {
    mockPathname.mockReturnValue("/assets");
    render(<Sidebar />);

    const assetsLink = screen.getByText("Assets").closest("a");
    expect(assetsLink).toHaveClass("bg-primary/10");
    expect(assetsLink).toHaveClass("text-primary");
  });

  it("highlights parent route when on child route", () => {
    mockPathname.mockReturnValue("/assets/123");
    render(<Sidebar />);

    const assetsLink = screen.getByText("Assets").closest("a");
    expect(assetsLink).toHaveClass("bg-primary/10");
  });

  it("shows collapse button", () => {
    render(<Sidebar />);
    expect(screen.getByText("Collapse")).toBeInTheDocument();
  });

  it("collapses sidebar when collapse button is clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    const collapseButton = screen.getByTitle("Collapse");
    await user.click(collapseButton);

    // After collapse, the "TAG IT Admin" text should not be visible
    expect(screen.queryByText("TAG IT Admin")).not.toBeInTheDocument();
    // But the logo "T" should still be visible
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("expands sidebar when expand button is clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // First collapse
    const collapseButton = screen.getByTitle("Collapse");
    await user.click(collapseButton);

    // Then expand
    const expandButton = screen.getByTitle("Expand");
    await user.click(expandButton);

    // Should see full nav items again
    expect(screen.getByText("TAG IT Admin")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows tooltips on collapsed nav items", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Collapse sidebar
    const collapseButton = screen.getByTitle("Collapse");
    await user.click(collapseButton);

    // Links should have title attributes when collapsed
    const dashboardLink = screen.getByTitle("Dashboard");
    expect(dashboardLink).toBeInTheDocument();
  });

  it("renders all 8 navigation items", () => {
    render(<Sidebar />);

    const navItems = [
      "Dashboard",
      "Assets",
      "Users",
      "Badges",
      "Capabilities",
      "Resolve",
      "Governance",
      "Treasury",
    ];

    navItems.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it("applies correct styling to inactive items", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<Sidebar />);

    const assetsLink = screen.getByText("Assets").closest("a");
    expect(assetsLink).toHaveClass("text-muted-foreground");
    expect(assetsLink).not.toHaveClass("bg-primary/10");
  });
});
