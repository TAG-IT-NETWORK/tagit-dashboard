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
      formData.append("file", file);
      const res = await fetch("/api/media-proxy", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || `upload failed (${res.status})`);
      }
      const sha256: string | undefined = data.sha256 ?? data.media?.sha256;
      const mime: string = data.mime ?? data.media?.mime ?? file.type ?? "image/webp";
      const url: string | undefined =
        data.url ??
        data.media?.url ??
        (sha256 ? `https://media.tagit.network/i/${sha256}/lg.webp` : undefined);
      if (!sha256 || !url) {
        throw new Error("media pipeline returned no sha256/url");
      }
      onChange([
        ...media,
        {
          sha256,
          mime,
          url,
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
        accept="image/*"
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
