"use client";

import { useState } from "react";
import { Button, Label } from "@tagit/ui";
import { Loader2, Save } from "lucide-react";
import { validateOverridesDoc } from "@/lib/catalog/logic";

interface PublishResponse {
  ok?: boolean;
  created?: boolean;
  jcsHash?: string;
  version?: { version?: number };
  error?: string;
}

/**
 * Overrides JSON editor (slide-over). The JSON is validated client-side
 * (validateOverridesDoc — plain object, immutable tagit fields rejected) and
 * PUT to /api/catalog-proxy/assets/:tokenId/overrides, which publishes it as
 * the metadata doc overlay upstream (template fields + stored overrides +
 * this doc → new canonical version + scheduled anchor).
 *
 * NOTE: the services API does not expose the item's stored overrides, so the
 * editor starts empty rather than pre-filled — submitted fields layer on top
 * of whatever is already stored.
 */
export function OverridesEditor({
  tokenId,
  bound,
  onPublished,
}: {
  tokenId: string;
  /** Unbound items need backfill=true (anchor-after-bind escape hatch). */
  bound: boolean;
  onPublished?: () => void;
}) {
  const [text, setText] = useState("{\n  \n}");
  const [backfill, setBackfill] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const validation = validateOverridesDoc(text);
  const trimmedIsEmpty = validation.ok && Object.keys(validation.doc).length === 0;

  const submit = async () => {
    if (!validation.ok) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(`/api/catalog-proxy/assets/${tokenId}/overrides`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doc: validation.doc, ...(backfill ? { backfill: true } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as PublishResponse;
      if (!res.ok || data.ok === false) {
        setResult({ kind: "error", message: data.error ?? `Publish failed (HTTP ${res.status})` });
      } else if (data.created === false) {
        setResult({
          kind: "ok",
          message: "Doc unchanged — existing version kept (idempotent republish).",
        });
      } else {
        setResult({
          kind: "ok",
          message: `Published metadata v${data.version?.version ?? "?"} — anchor scheduled. jcs_hash ${
            data.jcsHash ?? "—"
          }`,
        });
        onPublished?.();
      }
    } catch (e) {
      setResult({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label htmlFor={`overrides-${tokenId}`}>Overrides doc (JSON overlay)</Label>
      <textarea
        id={`overrides-${tokenId}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={8}
        spellCheck={false}
        className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder='{ "description": "…", "tagit": { "brand": "…" } }'
      />
      {!validation.ok && <p className="text-xs text-destructive">{validation.error}</p>}
      {!bound && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={backfill}
            onChange={(e) => setBackfill(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Backfill (publish before tag bind — anchor-after-bind escape hatch)
        </label>
      )}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={submit}
          disabled={saving || !validation.ok || trimmedIsEmpty}
        >
          {saving ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-2 h-3.5 w-3.5" />
          )}
          Publish overrides
        </Button>
        <span className="text-xs text-muted-foreground">
          Publishes a new canonical metadata version and schedules its anchor.
        </span>
      </div>
      {result && (
        <p
          className={`text-xs ${result.kind === "ok" ? "text-green-500" : "text-destructive"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
