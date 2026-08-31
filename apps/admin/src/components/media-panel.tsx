"use client";

/**
 * Shared media upload panel (META-T18, extracted for reuse in META-T33).
 *
 * The upload flow is the T18 one, verbatim: files go through POST
 * /api/media-proxy (the services admin API key is injected server-side and
 * NEVER reaches this browser code), the first entry is the hero and removing
 * the hero promotes the next entry. Used by /assets/new (mint form) and the
 * /catalog template editor's Media tab — both own their media state and pass
 * it down; this component is presentation + upload only.
 */

import { useRef, useState } from "react";
import { Button } from "@tagit/ui";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

export interface UploadedMedia {
  sha256: string;
  mime: string;
  url: string;
  role: "hero" | "gallery";
  fileName: string;
}

interface MediaPanelProps {
  media: UploadedMedia[];
  onChange: (next: UploadedMedia[]) => void;
  disabled?: boolean;
}

/**
 * Parse the media pipeline response into { sha256, mime, url }.
 *
 * The services endpoint (POST /api/v1/media, passed through verbatim by the
 * proxy) returns { ok: true, media: [{ sha256, mime, urls: { orig|lg|md|sm|t },
 * … }] } — an ARRAY, one entry per uploaded file, with a `urls` variant map.
 * Older shapes ({ media: {…} } or top-level fields) are kept as fallbacks.
 * Exported for tests.
 */
export function parseMediaUploadResponse(
  data: unknown,
  fallbackMime: string,
): { sha256: string; mime: string; url: string } | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const entry = (
    Array.isArray(d.media)
      ? (d.media[0] ?? {})
      : typeof d.media === "object" && d.media
        ? d.media
        : d
  ) as Record<string, unknown>;
  const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : undefined;
  const mime = typeof entry.mime === "string" ? entry.mime : fallbackMime || "image/webp";
  const urls = (entry.urls ?? {}) as Record<string, unknown>;
  const url =
    (typeof urls.lg === "string" ? urls.lg : undefined) ??
    (typeof entry.url === "string" ? entry.url : undefined) ??
    (sha256 ? `https://media.tagit.network/i/${sha256}/lg.webp` : undefined);
  if (!sha256 || !url) return null;
  return { sha256, mime, url };
}

/** Human-readable error from a services ({ error: CODE, message }) or proxy ({ ok:false, error: text }) body. */
export function mediaUploadErrorMessage(data: unknown, status: number): string {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.message === "string" && d.message.length > 0) return d.message;
  if (typeof d.error === "string" && d.error.length > 0) return d.error;
  return `upload failed (${status})`;
}

export function MediaPanel({ media, onChange, disabled = false }: MediaPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      // The services endpoint accepts multipart field "files" ONLY
      // (multer upload.array("files") — any other name is a 400).
      formData.append("files", file);
      const res = await fetch("/api/media-proxy", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(mediaUploadErrorMessage(data, res.status));
      }
      const parsed = parseMediaUploadResponse(data, file.type);
      if (!parsed) {
        throw new Error("media pipeline returned no sha256/url");
      }
      onChange([
        ...media,
        {
          ...parsed,
          role: media.length === 0 ? "hero" : "gallery",
          fileName: file.name,
        },
      ]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeMedia = (key: string) => {
    const next = media.filter((m) => (m.sha256 || m.url) !== key);
    // Keep exactly one hero: promote the first remaining entry.
    onChange(next.map((m, i) => ({ ...m, role: i === 0 ? "hero" : "gallery" }) as UploadedMedia));
  };

  return (
    <div className="space-y-3">
      {media.map((m) => (
        <div
          key={m.sha256 || m.url}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{m.fileName}</span>
            <span className="text-xs text-muted-foreground uppercase">{m.role}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeMedia(m.sha256 || m.url)}
            disabled={disabled}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <input
        ref={fileInputRef}
        type="file"
        // Services hard-rejects SVG/HEIC by magic bytes — only offer what it accepts.
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleUpload}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || disabled}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Upload image
          </>
        )}
      </Button>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  );
}
