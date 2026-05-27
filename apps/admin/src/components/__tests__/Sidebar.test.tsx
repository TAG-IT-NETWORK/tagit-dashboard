import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, within, type BoundFunctions, type queries } from "@testing-library/react";
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

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

// The Sidebar renders its nav twice — once for the desktop <aside> and once for
// the mobile drawer <aside> — so every label appears twice in the DOM. Scope all
// queries to the desktop sidebar (the first <aside>) to keep lookups unambiguous.
function renderDesktop(): {
  ui: BoundFunctions<typeof queries>;
  user: ReturnType<typeof userEvent.setup>;
} {
  const user = userEvent.setup();
  const { container } = render(<Sidebar />);
  const desktop = container.querySelector("aside");
  if (!desktop) throw new Error("desktop <aside> not found");
  return { ui: within(desktop as HTMLElement), user };
}

// Full desktop navigation as currently defined in sidebar.tsx
const NAV_ITEMS = [
  "Dashboard",
  "Assets",
  "Users",
  "Badges",
  "Capabilities",
  "Resolve",
  "Governance",
  "Treasury",
  "Tokenomics",
  "AI Agents",
  "BD Agent",
  "Influencer",
  "Demo",
];

describe("Sidebar", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/dashboard");
  });

  it("renders the sidebar with navigation items", () => {
    const { ui } = renderDesktop();
    for (const item of [
      "Dashboard",
      "Assets",
      "Users",
      "Badges",
      "Capabilities",
      "Resolve",
      "Governance",
      "Treasury",
    ]) {
      expect(ui.getByText(item)).toBeInTheDocument();
    }
  });

  it("renders the TAG IT Admin logo", () => {
    const { ui } = renderDesktop();
    expect(ui.getByText("TAG IT Admin")).toBeInTheDocument();
    expect(ui.getByAltText("TAG IT")).toBeInTheDocument();
  });

  it("renders navigation links with correct hrefs", () => {
    const { ui } = renderDesktop();
    expect(ui.getByText("Dashboard").closest("a")).toHaveAttribute("href", "/dashboard");
    expect(ui.getByText("Assets").closest("a")).toHaveAttribute("href", "/assets");
    expect(ui.getByText("Users").closest("a")).toHaveAttribute("href", "/users");
    expect(ui.getByText("Governance").closest("a")).toHaveAttribute("href", "/governance");
    expect(ui.getByText("AI Agents").closest("a")).toHaveAttribute("href", "/agents");
  });

  it("highlights active navigation item based on pathname", () => {
    mockPathname.mockReturnValue("/assets");
    const { ui } = renderDesktop();
    const assetsLink = ui.getByText("Assets").closest("a");
    expect(assetsLink).toHaveClass("bg-primary/10");
    expect(assetsLink).toHaveClass("text-primary");
  });

  it("highlights parent route when on child route", () => {
    mockPathname.mockReturnValue("/assets/123");
    const { ui } = renderDesktop();
    const assetsLink = ui.getByText("Assets").closest("a");
    expect(assetsLink).toHaveClass("bg-primary/10");
  });

  it("shows collapse button", () => {
    const { ui } = renderDesktop();
    expect(ui.getByText("Collapse")).toBeInTheDocument();
  });

  it("collapses sidebar when collapse button is clicked", async () => {
    const { ui, user } = renderDesktop();
    await user.click(ui.getByTitle("Collapse"));
    // After collapse, the desktop "TAG IT Admin" text is hidden...
    expect(ui.queryByText("TAG IT Admin")).not.toBeInTheDocument();
    // ...but the logo image remains.
    expect(ui.getByAltText("TAG IT")).toBeInTheDocument();
  });

  it("expands sidebar when expand button is clicked", async () => {
    const { ui, user } = renderDesktop();
    await user.click(ui.getByTitle("Collapse"));
    await user.click(ui.getByTitle("Expand"));
    expect(ui.getByText("TAG IT Admin")).toBeInTheDocument();
    expect(ui.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows tooltips on collapsed nav items", async () => {
    const { ui, user } = renderDesktop();
    await user.click(ui.getByTitle("Collapse"));
    // Collapsed nav links expose a title attribute for tooltips.
    expect(ui.getByTitle("Dashboard")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    const { ui } = renderDesktop();
    for (const item of NAV_ITEMS) {
      expect(ui.getByText(item)).toBeInTheDocument();
    }
  });

  it("applies correct styling to inactive items", () => {
    mockPathname.mockReturnValue("/dashboard");
    const { ui } = renderDesktop();
    const assetsLink = ui.getByText("Assets").closest("a");
    expect(assetsLink).toHaveClass("text-muted-foreground");
    expect(assetsLink).not.toHaveClass("bg-primary/10");
  });
});
