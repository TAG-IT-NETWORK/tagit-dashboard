"use client";

/**
 * Publish rail — status, publish/archive actions and the immutable version
 * history (template_versions snapshots) with a diff view.
 *
 * Diff sources: any published snapshot or the current working copy (mapped
 * through the client mirror of buildTemplateSnapshot so shapes align).
 */

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tagit/ui";
import { Archive, GitCommitHorizontal, Loader2, Rocket } from "lucide-react";

import { SnapshotDiff } from "@/components/catalog/snapshot-diff";
import { StatusChip } from "@/components/catalog/status-chip";
import { workingCopySnapshot, type PublishState } from "@/lib/catalog/template-logic";
import type { TemplateDto, TemplateVersionDto } from "@/lib/catalog/template-types";

interface PublishRailProps {
  template: TemplateDto;
  versions: TemplateVersionDto[];
  publishState: PublishState;
  writable: boolean;
  /**
   * Publish is admin-only (META-T32 role map) while draft writes + archive
   * stay editor-level — the proxy enforces this server-side; this prop only
   * keeps the button honest.
   */
  canPublish: boolean;
  /** Refetch detail after publish/archive (versions list changed). */
  onChanged: () => void;
}

const WORKING = "working";

export function PublishRail({
  template,
  versions,
  publishState,
  writable,
  canPublish,
  onChanged,
}: PublishRailProps) {
  const [busy, setBusy] = useState<"publish" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const sorted = useMemo(() => [...versions].sort((a, b) => b.version - a.version), [versions]);

  const [fromKey, setFromKey] = useState<string>(() =>
    sorted.length > 1 ? String(sorted[1].version) : sorted.length === 1 ? String(sorted[0].version) : WORKING,
  );
  const [toKey, setToKey] = useState<string>(() =>
    publishState.workingDirty || sorted.length === 0 ? WORKING : String(sorted[0].version),
  );

  const snapshotFor = (key: string): { value: unknown; label: string } | null => {
    if (key === WORKING) return { value: workingCopySnapshot(template), label: "working copy" };
    const v = sorted.find((s) => String(s.version) === key);
    return v ? { value: v.snapshot, label: `v${v.version}` } : null;
  };
  const from = snapshotFor(fromKey);
  const to = snapshotFor(toKey);

  const post = async (verb: "publish" | "archive") => {
    setBusy(verb);
    setError(null);
    try {
      const res = await fetch(`/api/catalog-proxy/templates/${template.id}/${verb}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `${verb} failed (${res.status})`);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${verb} failed`);
    } finally {
      setBusy(null);
      setConfirmArchive(false);
    }
  };

  const archived = template.status === "archived";
  const canWrite = writable && !archived;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Publish
          <StatusChip status={template.status} />
        </CardTitle>
        <CardDescription>
          {publishState.latestVersion === 0
            ? "Never published — items can only adopt published snapshots."
            : `Latest published snapshot: v${publishState.latestVersion}.`}
          {publishState.workingDirty && " Working copy has unpublished changes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => post("publish")}
            disabled={!canWrite || !canPublish || busy !== null}
            title={
              !canPublish
                ? "Publishing requires the admin role"
                : publishState.latestVersion > 0 && !publishState.workingDirty
                  ? "Working copy matches the latest snapshot — publishing inserts an identical version"
                  : undefined
            }
          >
            {busy === "publish" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Publish v{publishState.latestVersion + 1}
              </>
            )}
          </Button>
          {!archived &&
            (confirmArchive ? (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => post("archive")}
                  disabled={!canWrite || busy !== null}
                >
                  {busy === "archive" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirm archive"
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setConfirmArchive(true)}
                disabled={!canWrite || busy !== null}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive template
              </Button>
            ))}
          {confirmArchive && (
            <p className="text-xs text-muted-foreground">
              Soft archive: snapshots stay in place and keep serving; edits and publishes are
              rejected until unarchived server-side.
            </p>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Version history */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Version history
          </p>
          {sorted.length === 0 && (
            <p className="text-xs text-muted-foreground">No published versions yet.</p>
          )}
          {sorted.map((v) => (
            <div key={v.version} className="flex items-center gap-2 text-sm">
              <GitCommitHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-mono font-medium">v{v.version}</span>
              <span className="text-xs text-muted-foreground truncate">
                {v.publishedBy} · {new Date(v.publishedAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Diff view */}
        {(sorted.length > 0 || publishState.workingDirty) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Diff
            </p>
            <div className="flex items-center gap-2 text-xs">
              <select
                value={fromKey}
                onChange={(e) => setFromKey(e.target.value)}
                className="flex-1 h-8 rounded-md border border-input bg-transparent px-2"
              >
                {sorted.map((v) => (
                  <option key={v.version} value={String(v.version)}>
                    v{v.version}
                  </option>
                ))}
                <option value={WORKING}>Working copy</option>
              </select>
              <span className="text-muted-foreground">→</span>
              <select
                value={toKey}
                onChange={(e) => setToKey(e.target.value)}
                className="flex-1 h-8 rounded-md border border-input bg-transparent px-2"
              >
                {sorted.map((v) => (
                  <option key={v.version} value={String(v.version)}>
                    v{v.version}
                  </option>
                ))}
                <option value={WORKING}>Working copy</option>
              </select>
            </div>
            {from && to && (
              <SnapshotDiff
                older={from.value}
                newer={to.value}
                olderLabel={from.label}
                newerLabel={to.label}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
