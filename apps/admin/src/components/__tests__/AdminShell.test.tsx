import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminShell } from "../admin-shell";

// Mock the Sidebar component
vi.mock("../sidebar", () => ({
  Sidebar: () => <aside data-testid="sidebar">Sidebar</aside>,
}));

// Mock the Header component
vi.mock("../header", () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

describe("AdminShell", () => {
  it("renders children content", () => {
    render(
      <AdminShell>
        <div data-testid="test-content">Test Content</div>
      </AdminShell>
    );

    expect(screen.getByTestId("test-content")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("renders the Sidebar component", () => {
    render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("renders the Header component", () => {
    render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("wraps content in a flex container", () => {
    const { container } = render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("flex");
    expect(wrapper).toHaveClass("h-screen");
  });

  it("renders main element with correct classes", () => {
    render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    const main = screen.getByRole("main");
    expect(main).toHaveClass("flex-1");
    expect(main).toHaveClass("overflow-y-auto");
    expect(main).toHaveClass("p-6");
  });

  it("renders multiple children correctly", () => {
    render(
      <AdminShell>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </AdminShell>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
    expect(screen.getByTestId("child-3")).toBeInTheDocument();
  });

  it("renders complex nested children", () => {
    render(
      <AdminShell>
        <div>
          <h1>Page Title</h1>
          <p>Page description</p>
          <div>
            <span>Nested content</span>
          </div>
        </div>
      </AdminShell>
    );

    expect(screen.getByText("Page Title")).toBeInTheDocument();
    expect(screen.getByText("Page description")).toBeInTheDocument();
    expect(screen.getByText("Nested content")).toBeInTheDocument();
  });

  it("maintains proper layout structure", () => {
    const { container } = render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    // Root is flex container
    const root = container.firstChild as HTMLElement;
    expect(root.tagName.toLowerCase()).toBe("div");
    expect(root).toHaveClass("flex");

    // Should have sidebar and content area
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("applies background color class", () => {
    const { container } = render(
      <AdminShell>
        <div>Content</div>
      </AdminShell>
    );

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("bg-background");
  });
});
