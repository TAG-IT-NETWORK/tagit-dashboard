"use client";

import { useRef, useState } from "react";
import { Button, Input, Label } from "@tagit/ui";
import { ImageUp, Loader2, X } from "lucide-react";

import { LOGO_FILE_TYPES, isShowableLogo, logoFileProblem, logoUrlFromUpload } from "@/lib/brands";
import { upstreamErrorMessage } from "@/lib/upstream-error";

/**
 * The logo on a brand's card (TAP-T17): a small preview, an Upload button and
 * the address itself.
 *
 * Upload goes through /api/media-proxy, the same door product photos use, so
 * the image lands in our own media storage and the services key stays on the
 * server. The upload only fills the address in: nothing is kept on the
 * brand's record until Save is pressed.
 */
export function BrandLogoField({
  id,
  brandName,
  value,
  disabled = false,
  onChange,
  onUploadingChange,
}: {
  id: string;
  brandName: string;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  /** Told when an upload starts and ends, so the card can hold Save meanwhile. */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "done"; text: string } | null>(null);
  // The address that failed to load, so a new address gets a fresh try.
  const [broken, setBroken] = useState<string | null>(null);

  const address = value.trim();
  const showable = isShowableLogo(address) && broken !== address;
  const locked = disabled || uploading;

  /** Every change of address clears the "could not load" mark, so it is tried again. */
  function change(next: string) {
    setBroken(null);
    onChange(next);
  }

  async function upload(file: File) {
    const problem = logoFileProblem(file);
    if (problem) {
      setMessage({ kind: "error", text: problem });
      return;
    }
    setUploading(true);
    onUploadingChange?.(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("files", file);
      const res = await fetch("/api/media-proxy", { method: "POST", body });
      const data: unknown = await res.json().catch(() => null);
      const url = res.ok ? logoUrlFromUpload(data) : null;
      if (url === null) {
        setMessage({
          kind: "error",
          text: res.ok
            ? "The image was sent, but no address came back. Please try again."
            : upstreamErrorMessage(data, res.status, "upload"),
        });
        return;
      }
      change(url);
      setMessage({ kind: "done", text: "Logo uploaded. Press Save to keep it." });
    } catch {
      setMessage({
        kind: "error",
        text: "The upload did not go through. Check your connection and try again.",
      });
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Logo</Label>
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-xs font-semibold text-muted-foreground"
          data-logo-preview={showable ? "image" : "none"}
        >
          {showable ? (
            // The brand's own logo, from an https address checked above.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={address}
              alt={`${brandName} logo`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain"
              onError={() => setBroken(address)}
            />
          ) : (
            <span aria-hidden="true">{brandName.trim().charAt(0).toUpperCase() || "?"}</span>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={LOGO_FILE_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label={`Choose a logo image for ${brandName}`}
          disabled={locked}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Clear the choice so picking the same file again still fires.
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={locked}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImageUp className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="ml-2">{uploading ? "Uploading…" : "Upload logo"}</span>
        </Button>
        {address.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={locked}
            onClick={() => {
              change("");
              setMessage({ kind: "done", text: "Logo removed. Press Save to keep it that way." });
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="ml-1">Remove</span>
          </Button>
        )}
      </div>
      <Input
        id={id}
        placeholder="Or paste an image address: https://…"
        value={value}
        disabled={locked}
        onChange={(e) => {
          setMessage(null);
          change(e.target.value);
        }}
      />
      {address.length > 0 && !isShowableLogo(address) && (
        <p className="text-xs text-destructive">
          This address will not show: a logo address must start with https://
        </p>
      )}
      {broken === address && address.length > 0 && (
        <p className="text-xs text-destructive">
          No image could be loaded from this address. Use a direct link to the image file.
        </p>
      )}
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            message.kind === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
        >
          {message.text}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        PNG, JPG or WebP, up to 4.5 MB. A square mark with a clear background reads best.
      </p>
    </div>
  );
}
