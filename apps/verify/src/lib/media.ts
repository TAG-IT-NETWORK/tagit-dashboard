/**
 * Media CDN helpers — pure functions, safe for client and server bundles.
 *
 * The media pipeline (tagit-services) pre-bakes exactly three webp variants per
 * upload and serves them from the CloudFront distribution at
 * https://media.tagit.network/i/<sha256>/{sm,md,lg}.webp. The verify app must
 * NEVER route these through Vercel's image optimizer (that would re-optimize
 * already-optimized assets and bill per transformation), so next/image uses the
 * custom loader below: it maps the requested render width onto the nearest
 * pre-baked variant and returns the CDN URL untouched otherwise.
 */

export const MEDIA_HOST = "media.tagit.network";

/** Rendered-image hosts the verify app will put inside an <img>/next-image. */
export const ALLOWED_IMAGE_HOSTS: ReadonlySet<string> = new Set([
  MEDIA_HOST,
  // Legacy IPFS gateways still referenced by pre-cutover tokenURI metadata.
  "w3s.link",
  "ipfs.io",
  "cloudflare-ipfs.com",
  "gateway.pinata.cloud",
  "nftstorage.link",
]);

/** True when `url` is an https URL on a host we allow to serve product images. */
export function isAllowedImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(parsed.hostname);
}

export type MediaVariant = "sm" | "md" | "lg";

/** Pre-baked variant pixel widths (longest edge), matching the media pipeline. */
export const VARIANT_WIDTHS: Readonly<Record<MediaVariant, number>> = {
  sm: 384,
  md: 828,
  lg: 1600,
};

/**
 * Requested render width → nearest pre-baked variant (never downscale to a
 * variant smaller than the request unless the request exceeds lg).
 */
export function variantForWidth(width: number): MediaVariant {
  if (width <= VARIANT_WIDTHS.sm) return "sm";
  if (width <= VARIANT_WIDTHS.md) return "md";
  return "lg";
}

const MEDIA_VARIANT_PATH_RE = /^\/i\/([0-9a-f]{64})\/(sm|md|lg)\.webp$/;

/**
 * Rewrite a media-CDN variant URL to the variant nearest `width`. URLs that are
 * not media.tagit.network /i/<sha>/{sm,md,lg}.webp come back unchanged — the
 * loader is a pass-through for them, so Vercel still never re-optimizes.
 */
export function mediaVariantUrl(src: string, width: number): string {
  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return src;
  }
  if (parsed.hostname !== MEDIA_HOST) return src;
  const match = MEDIA_VARIANT_PATH_RE.exec(parsed.pathname);
  if (!match) return src;
  parsed.pathname = `/i/${match[1]}/${variantForWidth(width)}.webp`;
  return parsed.toString();
}

/** next/image custom loader. Quality is ignored — variants are pre-encoded. */
export function mediaImageLoader({ src, width }: { src: string; width: number }): string {
  return mediaVariantUrl(src, width);
}
