"use client";

/**
 * Per-batch exception log (META-T35) — read view over the append-only
 * binding_exceptions table (GET /api/catalog-proxy/binding/exceptions).
 *
 * Rows carry operator free text (reason) and system detail — everything is
 * rendered as plain text nodes (React-escaped), never as markup.
 */

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tagit/ui";
import { Loader2, RotateCw } from "lucide-react";

interface ExceptionRow {
  id: number | null;
  createdAt: string | null;
  type: string;
  tokenId: string;
  reason: string;
  operatorId: string;
  replacementTokenId: string | null;
  recycleTxHash: string | null;
}

const TYPE_BADGE: Record<string, { label: string; variant: "warning" | "destructive" | "secondary" }> = {
  chip_defective_prebind: { label: "Chip skipped", variant: "warning" },
  wrong_tap_reassign: { label: "Reassigned", variant: "secondary" },
  void_remint: { label: "Void + remint", variant: "destructive" },
};

function parseRows(body: unknown): ExceptionRow[] | null {
  const list = (body as { exceptions?: unknown } | null)?.exceptions;
  if (!Array.isArray(list)) return null;
  return list.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: typeof r?.id === "number" ? r.id : null,
      createdAt: typeof r?.createdAt === "string" ? r.createdAt : null,
      type: typeof r?.type === "string" ? r.type : "unknown",
      tokenId: typeof r?.tokenId === "string" ? r.tokenId : "?",
      reason: typeof r?.reason === "string" ? r.reason : "",
      operatorId: typeof r?.operatorId === "string" ? r.operatorId : "",
      replacementTokenId:
        typeof r?.replacementTokenId === "string" ? r.replacementTokenId : null,
      recycleTxHash: typeof r?.recycleTxHash === "string" ? r.recycleTxHash : null,
    };
  });
}

export function ExceptionLog({ batchId }: { batchId: string }) {
  const [rows, setRows] = useState<ExceptionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/catalog-proxy/binding/exceptions?batchId=${encodeURIComponent(batchId)}`,
        { cache: "no-store" },
      );
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : `exceptions returned ${res.status}`);
        return;
      }
      const parsed = parseRows(body);
      if (parsed === null) {
        setError("Unexpected exceptions response shape");
        return;
      }
      setRows(parsed);
    } catch {
      setError("Could not reach the exceptions endpoint");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Exception log</CardTitle>
            <CardDescription>
              Append-only binding_exceptions for this batch — skips, reassigns, void+remints.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCw className="mr-2 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Token</th>
                <th className="px-4 py-2 font-medium">Reason</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Operator</th>
                <th className="px-4 py-2 font-medium hidden lg:table-cell">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows === null || rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {loading ? "Loading…" : "No exceptions recorded for this batch."}
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => {
                  const badge = TYPE_BADGE[row.type] ?? { label: row.type, variant: "secondary" as const };
                  return (
                    <tr key={row.id ?? `row-${i}`} className="border-b last:border-0 align-top">
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-muted-foreground">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-2 text-sm">#{row.tokenId}</td>
                      {/* Operator free text — plain text node, deliberately inert. */}
                      <td className="max-w-md break-words px-4 py-2 text-sm">{row.reason}</td>
                      <td className="hidden px-4 py-2 text-sm text-muted-foreground md:table-cell">
                        {row.operatorId}
                      </td>
                      <td className="hidden px-4 py-2 text-xs text-muted-foreground lg:table-cell">
                        {row.replacementTokenId && <div>→ token #{row.replacementTokenId}</div>}
                        {row.recycleTxHash && (
                          <code className="break-all">{row.recycleTxHash}</code>
                        )}
                        {!row.replacementTokenId && !row.recycleTxHash && "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
