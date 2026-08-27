"use client";

/**
 * /catalog/:id editor shell (META-T33). Loads the template detail (working
 * copy + published version history) through the server proxy, and hosts:
 *
 *   left  — Details / Media / Pricing / Items tabs
 *   right — Publish rail (status, version history, diff, publish/archive)
 *
 * All writes go through /api/catalog-proxy/* (admin key server-side,
 * REQ-S-16 X-Actor forwarded); viewer role renders everything read-only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@tagit/ui";
import { AlertTriangle, ArrowLeft, GitFork, Layers, Loader2 } from "lucide-react";

import { DetailsTab } from "@/components/catalog/details-tab";
import { ItemsTab } from "@/components/catalog/items-tab";
import { MediaTab } from "@/components/catalog/media-tab";
import { PricingTab } from "@/components/catalog/pricing-tab";
import { PublishRail } from "@/components/catalog/publish-rail";
import { StatusChip } from "@/components/catalog/status-chip";
import {
  canMutateCatalog,
  canPublishCatalog,
  computePublishState,
  type CatalogRole,
} from "@/lib/catalog/template-logic";
import type {
  TemplateDto,
  TemplateUpdateResponse,
  TemplateVersionDto,
} from "@/lib/catalog/template-types";

const TABS = ["Details", "Media", "Pricing", "Items"] as const;
type Tab = (typeof TABS)[number];

interface TemplateEditorProps {
  id: string;
  role: CatalogRole | null;
}

export function TemplateEditor({ id, role }: TemplateEditorProps) {
  const [template, setTemplate] = useState<TemplateDto | null>(null);
  const [versions, setVersions] = useState<TemplateVersionDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Details");
  const [forkNotice, setForkNotice] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/catalog-proxy/templates/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.template) {
        throw new Error(data.error || `load failed (${res.status})`);
      }
      setTemplate(data.template as TemplateDto);
      setVersions((data.versions ?? []) as TemplateVersionDto[]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Shared PUT for the tabs. Returns the upstream error string (null on
   * success) so tabs can render it inline. `forked: true` responses surface
   * the fork-on-edit banner (published snapshot keeps serving until the next
   * publish).
   */
  const saveTemplate = useCallback(
    async (patch: Record<string, unknown>): Promise<string | null> => {
      try {
        const res = await fetch(`/api/catalog-proxy/templates/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await res.json()) as TemplateUpdateResponse;
        if (!res.ok || !data.ok || !data.template) {
          return data.error || `save failed (${res.status})`;
        }
        setTemplate(data.template);
        if (data.forked) setForkNotice(true);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Save failed";
      }
    },
    [id],
  );

  const publishState = useMemo(
    () => (template ? computePublishState(template, versions) : null),
    [template, versions],
  );

  const writable = canMutateCatalog(role);
  const canPublish = canPublishCatalog(role);
  const editable = writable && template?.status !== "archived";

  if (loading && !template) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading template…
      </div>
    );
  }

  if (loadError || !template || !publishState) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/catalog">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Catalog
          </Link>
        </Button>
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError ?? "Template not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/catalog">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Catalog
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate flex items-center gap-3">
            {template.name}
            <StatusChip status={template.status} />
          </h1>
          <p className="text-muted-foreground text-xs font-mono truncate">
            {template.id} · {template.slug}
          </p>
        </div>
        {/* META-T34: batch mint wizard entry (quantity/CSV → mint → labels). */}
        <Button variant="outline" size="sm" asChild className="ml-auto">
          <Link href={`/catalog/${id}/batch`}>
            <Layers className="h-4 w-4 mr-2" />
            Batch mint
          </Link>
        </Button>
      </div>

      {!writable && (
        <div className="rounded-md border bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
          Viewer role — read-only.
        </div>
      )}
      {template.status === "archived" && (
        <div className="rounded-md border bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
          Archived — edits and publishes are rejected by the server.
        </div>
      )}
      {forkNotice && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm">
          <GitFork className="h-4 w-4 shrink-0 mt-0.5 text-yellow-500" />
          <span>
            Edit forked the working copy off the published snapshot — v{publishState.latestVersion}{" "}
            keeps serving items until you publish again.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),340px]">
        {/* Tabs */}
        <div className="space-y-4 min-w-0">
          <div className="flex gap-1 border-b">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  tab === t
                    ? "px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary -mb-px"
                    : "px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                }
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Details" && (
            <DetailsTab template={template} disabled={!editable} onSave={saveTemplate} />
          )}
          {tab === "Media" && (
            <MediaTab template={template} disabled={!editable} onSave={saveTemplate} />
          )}
          {tab === "Pricing" && (
            <PricingTab template={template} disabled={!editable} onSave={saveTemplate} />
          )}
          {tab === "Items" && (
            <ItemsTab template={template} publishState={publishState} writable={editable} />
          )}
        </div>

        {/* Publish rail */}
        <PublishRail
          template={template}
          versions={versions}
          publishState={publishState}
          writable={writable}
          canPublish={canPublish}
          onChanged={() => {
            setForkNotice(false);
            void load();
          }}
        />
      </div>
    </div>
  );
}
