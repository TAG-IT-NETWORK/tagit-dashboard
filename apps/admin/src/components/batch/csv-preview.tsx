"use client";

/**
 * Step-1 CSV validation preview table (META-T34). Pure presentational —
 * receives the buildCsvPreview() result (optionally with server errors
 * attached) and renders per-row inline errors.
 *
 * SECURITY: cell contents come straight from the uploaded file and are
 * rendered EXCLUSIVELY as JSX text nodes — React escapes them, so hostile
 * strings (`<img onerror>`, `=HYPERLINK(...)`) stay inert markup-wise; the
 * REQ-S-29 denylist handles the spreadsheet side (pinned unit tests).
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { CsvPreview as CsvPreviewData } from "@/lib/catalog/batch-logic";

const MAX_RENDERED_ROWS = 60;
const MAX_CELL_CHARS = 120;

/** Display-only truncation — validation always ran on the full value. */
function clipCell(value: string): string {
  return value.length > MAX_CELL_CHARS ? `${value.slice(0, MAX_CELL_CHARS)}…` : value;
}

export function CsvPreviewTable({ preview }: { preview: CsvPreviewData }) {
  if (preview.structuralError !== null) {
    return (
      <div
        data-testid="csv-structural-error"
        className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {preview.structuralError}
      </div>
    );
  }

  const rendered = preview.rows.slice(0, MAX_RENDERED_ROWS);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        {preview.ok ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>
              {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} valid — ready to
              create
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-destructive">
              {preview.errorCount} error{preview.errorCount === 1 ? "" : "s"} across{" "}
              {preview.rows.filter((r) => r.errors.length > 0).length} row
              {preview.rows.filter((r) => r.errors.length > 0).length === 1 ? "" : "s"} — nothing
              is created until every row passes
            </span>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-2 py-1.5 font-medium text-muted-foreground">#</th>
              {preview.header.map((col, i) => (
                <th key={i} className="px-2 py-1.5 font-medium text-muted-foreground">
                  {col}
                </th>
              ))}
              <th className="px-2 py-1.5 font-medium text-muted-foreground">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rendered.map((row) => (
              <tr
                key={row.row}
                data-testid={`csv-row-${row.row}`}
                className={`border-b last:border-0 ${row.errors.length > 0 ? "bg-destructive/5" : ""}`}
              >
                <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">{row.row}</td>
                {preview.header.map((_, c) => (
                  <td key={c} className="px-2 py-1.5 font-mono text-xs break-all">
                    {clipCell(row.cells[c] ?? "")}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-xs text-destructive">
                  {row.errors.map((error, i) => (
                    <div key={i}>{error}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.rows.length > MAX_RENDERED_ROWS && (
        <p className="text-xs text-muted-foreground">
          Showing first {MAX_RENDERED_ROWS} of {preview.rows.length} rows — every row was
          validated.
        </p>
      )}
    </div>
  );
}
