import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CsvPreviewTable } from "../batch/csv-preview";
import { buildCsvPreview } from "@/lib/catalog/batch-logic";

/**
 * META-T34 acceptance: the CSV preview renderer keeps HOSTILE strings inert —
 * uploaded cell content must never become live markup, and formula-leading
 * cells surface the REQ-S-29 guard inline.
 */

describe("CsvPreviewTable", () => {
  it("renders hostile HTML cell content as inert text (no elements injected)", () => {
    const hostile = '<img src=x onerror="window.__pwned=true"><script>window.__pwned=true</script>';
    const preview = buildCsvPreview(`serial,name_override\nSN-1,"${hostile.replace(/"/g, '""')}"`);
    expect(preview.structuralError).toBeNull();

    const { container } = render(<CsvPreviewTable preview={preview} />);

    // The string renders as TEXT — no img/script node exists in the DOM.
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(container.textContent).toContain('<img src=x onerror="window.__pwned=true">');
  });

  it("flags quoted-formula cells with the REQ-S-29 guard inline on their row", () => {
    const preview = buildCsvPreview('serial,name_override\nSN-1,"=HYPERLINK(""http://evil"")"');
    render(<CsvPreviewTable preview={preview} />);

    const row = screen.getByTestId("csv-row-1");
    expect(row.textContent).toContain('=HYPERLINK("http://evil")');
    expect(row.textContent).toMatch(/REQ-S-29/);
    expect(screen.getByText(/nothing is created/i)).toBeInTheDocument();
  });

  it("shows per-row errors inline next to the offending row only", () => {
    const preview = buildCsvPreview("serial\nSN-1\n\nSN-1");
    render(<CsvPreviewTable preview={preview} />);

    expect(screen.getByTestId("csv-row-2").textContent).toContain("serial is required");
    expect(screen.getByTestId("csv-row-3").textContent).toContain("duplicate serial 'SN-1'");
    expect(screen.getByTestId("csv-row-1").textContent).not.toContain("serial is required");
  });

  it("renders structural rejects as a single banner (no table)", () => {
    const preview = buildCsvPreview("serial,oops\nSN-1,x");
    render(<CsvPreviewTable preview={preview} />);

    expect(screen.getByTestId("csv-structural-error").textContent).toMatch(/unknown CSV column/);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("announces a clean preview as ready to create", () => {
    const preview = buildCsvPreview("serial,price_usdc\nSN-1,19.99\nSN-2,");
    render(<CsvPreviewTable preview={preview} />);

    expect(screen.getByText(/2 rows valid — ready to create/i)).toBeInTheDocument();
  });
});
