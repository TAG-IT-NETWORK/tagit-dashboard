"use client";

/**
 * Media tab — REUSES the T18 MediaPanel + /api/media-proxy upload path
 * (services API key stays server-side).
 *
 * Persistence: product_templates has no media column (services schema), so
 * media is stored as reserved attribute rows — media:hero / media:gallery
 * with the variant URL as the value (see lib/catalog/template-logic.ts).
 * The services renderer (templateSnapshotToDocFields) lifts these rows into
 * the published item doc's image + tagit.media, which is what the verify
 * page and mobile app display.
 */

import { useMemo, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tagit/ui";
import { Loader2, Save } from "lucide-react";

import { MediaPanel, type UploadedMedia } from "@/components/media-panel";
import { mediaListFromAttributes, mergeMediaIntoAttributes } from "@/lib/catalog/template-logic";
import type { TemplateDto } from "@/lib/catalog/template-types";

interface MediaTabProps {
  template: TemplateDto;
  disabled: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<string | null>;
}

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const parts = path.split("/").filter(Boolean);
    return parts.slice(-2).join("/") || url;
  } catch {
    return url;
  }
}

export function MediaTab({ template, disabled, onSave }: MediaTabProps) {
  const stored = useMemo(
    () =>
      mediaListFromAttributes(template.attributes).map<UploadedMedia>((m) => ({
        sha256: "",
        mime: "",
        url: m.url,
        role: m.role,
        fileName: fileNameFromUrl(m.url),
      })),
    [template.attributes],
  );

  const [media, setMedia] = useState<UploadedMedia[]>(stored);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (next: UploadedMedia[]) => {
    setMedia(next);
    setDirty(true);
    setError(null);
  };

  const save = async () => {
    if (disabled || saving) return;
    const merged = mergeMediaIntoAttributes(
      template.attributes,
      media.map((m) => ({ role: m.role, url: m.url })),
    );
    if (!merged.ok) {
      setError(merged.error);
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onSave({
      attributes: merged.attributes.length > 0 ? merged.attributes : null,
    });
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setDirty(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Media</CardTitle>
        <CardDescription>
          Uploads go through the server-side media proxy — the services API key never reaches this
          browser. Stored on the template as media:hero / media:gallery attribute rows (the services
          template schema has no media column); on publish they become the item image and gallery
          shown on the verify page and in the apps. First upload is the hero.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MediaPanel media={media} onChange={onChange} disabled={disabled} />
        {media.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {media.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element -- remote media host previews
              <img
                key={m.url}
                src={m.url}
                alt={m.fileName}
                className="aspect-square w-full rounded-md border object-cover"
                loading="lazy"
              />
            ))}
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={save} disabled={disabled || saving || !dirty}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save media
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
