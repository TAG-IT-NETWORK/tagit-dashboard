import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  MediaPanel,
  mediaUploadErrorMessage,
  parseMediaUploadResponse,
  type UploadedMedia,
} from "../media-panel";

/**
 * Regression tests for the live VALIDATION_ERROR upload bug (2026-08-31):
 * the panel posted multipart field "file" but the services endpoint accepts
 * ONLY "files" (multer upload.array), and it parsed a response shape the
 * services never returned ({ sha256 } top-level vs { media: [{ … urls }] }).
 */

const SHA = "b".repeat(64);
const SERVICES_OK = {
  ok: true,
  media: [
    {
      sha256: SHA,
      mime: "image/png",
      urls: {
        orig: `https://media.tagit.network/i/${SHA}/orig.webp`,
        lg: `https://media.tagit.network/i/${SHA}/lg.webp`,
      },
    },
  ],
};

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pickFile(name = "cream.png"): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, {
    type: "image/png",
  });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("parseMediaUploadResponse", () => {
  it("parses the real services array shape, url from urls.lg", () => {
    expect(parseMediaUploadResponse(SERVICES_OK, "image/png")).toEqual({
      sha256: SHA,
      mime: "image/png",
      url: `https://media.tagit.network/i/${SHA}/lg.webp`,
    });
  });

  it("falls back to the constructed lg URL when urls is absent", () => {
    const parsed = parseMediaUploadResponse({ ok: true, media: [{ sha256: SHA }] }, "image/jpeg");
    expect(parsed).toEqual({
      sha256: SHA,
      mime: "image/jpeg",
      url: `https://media.tagit.network/i/${SHA}/lg.webp`,
    });
  });

  it("still accepts legacy top-level and single-object shapes", () => {
    expect(parseMediaUploadResponse({ ok: true, sha256: SHA, mime: "image/webp" }, "")).toEqual({
      sha256: SHA,
      mime: "image/webp",
      url: `https://media.tagit.network/i/${SHA}/lg.webp`,
    });
    expect(
      parseMediaUploadResponse({ ok: true, media: { sha256: SHA, url: "https://x/y.webp" } }, ""),
    ).toEqual({ sha256: SHA, mime: "image/webp", url: "https://x/y.webp" });
  });

  it("returns null when no sha256 is present (empty media array)", () => {
    expect(parseMediaUploadResponse({ ok: true, media: [] }, "image/png")).toBeNull();
  });
});

describe("mediaUploadErrorMessage", () => {
  it("prefers the human message over the services error CODE", () => {
    expect(
      mediaUploadErrorMessage(
        {
          error: "VALIDATION_ERROR",
          message: 'At most 12 files per request, in the "files" field',
        },
        400,
      ),
    ).toBe('At most 12 files per request, in the "files" field');
  });

  it("falls back to the proxy's error text, then to the status", () => {
    expect(mediaUploadErrorMessage({ ok: false, error: "viewer role is read-only" }, 403)).toBe(
      "viewer role is read-only",
    );
    expect(mediaUploadErrorMessage({}, 502)).toBe("upload failed (502)");
  });
});

describe("MediaPanel upload", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => jsonResponse(SERVICES_OK));
    vi.stubGlobal("fetch", fetchMock);
    onChange = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the file under multipart field "files" (the only name services accepts)', async () => {
    render(<MediaPanel media={[]} onChange={onChange} />);
    pickFile();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/media-proxy");
    const body = init.body as FormData;
    expect(body.get("files")).toBeInstanceOf(File);
    expect(body.get("file")).toBeNull();
  });

  it("parses the services response and reports the hero entry", async () => {
    render(<MediaPanel media={[]} onChange={onChange} />);
    pickFile("cream.png");
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

    expect(onChange).toHaveBeenCalledWith([
      {
        sha256: SHA,
        mime: "image/png",
        url: `https://media.tagit.network/i/${SHA}/lg.webp`,
        role: "hero",
        fileName: "cream.png",
      },
    ]);
  });

  it("appends as gallery when a hero already exists", async () => {
    const existing: UploadedMedia[] = [
      {
        sha256: "c".repeat(64),
        mime: "image/webp",
        url: "https://x/hero.webp",
        role: "hero",
        fileName: "hero.webp",
      },
    ];
    render(<MediaPanel media={existing} onChange={onChange} />);
    pickFile("side.png");
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

    const next = onChange.mock.calls[0]![0] as UploadedMedia[];
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ role: "gallery", fileName: "side.png" });
  });

  it("surfaces the upstream message — never the bare VALIDATION_ERROR code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: "VALIDATION_ERROR",
          message:
            "Unrecognized image format — content must be JPEG, PNG or WebP (magic-byte check)",
        },
        400,
      ),
    );
    render(<MediaPanel media={[]} onChange={onChange} />);
    pickFile();

    await waitFor(() =>
      expect(
        screen.getByText(
          "Unrecognized image format — content must be JPEG, PNG or WebP (magic-byte check)",
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("VALIDATION_ERROR")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a clear error when the pipeline returns no usable media entry", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, media: [] }));
    render(<MediaPanel media={[]} onChange={onChange} />);
    pickFile();

    await waitFor(() =>
      expect(screen.getByText("media pipeline returned no sha256/url")).toBeInTheDocument(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
