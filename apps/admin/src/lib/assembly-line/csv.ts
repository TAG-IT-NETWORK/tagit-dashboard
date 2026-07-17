/**
 * Pure CSV building for the Assembly Line results export — kept free of DOM
 * APIs (Blob/URL) so it's directly unit-testable. downloadResultsCsv() below
 * is the thin DOM-touching wrapper used by the console component.
 */

export interface RunResultRow {
  uid: string;
  tokenId: bigint;
  tagId: `0x${string}`;
}

/** Builds a CSV string (UID, Token ID, Tag ID) from a completed run's results. */
export function buildResultsCsv(rows: RunResultRow[]): string {
  const header = ["UID", "Token ID", "Tag ID"];
  const body = rows.map((row) => [row.uid, row.tokenId.toString(), row.tagId]);
  return [header, ...body].map((cols) => cols.join(",")).join("\n");
}

/** Triggers a client-side download of the results CSV via a blob URL. */
export function downloadResultsCsv(rows: RunResultRow[], filename?: string): void {
  const csv = buildResultsCsv(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `assembly-line-run-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
