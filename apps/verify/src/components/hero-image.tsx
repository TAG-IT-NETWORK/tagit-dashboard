"use client";

import Image from "next/image";
import { isAllowedImageUrl, mediaImageLoader } from "@/lib/media";

/**
 * Product photo for the shopper pages.
 *
 * next/image with the CUSTOM media loader: requested widths map onto the
 * pre-baked CDN variants (media.tagit.network/i/<sha>/{sm,md,lg}.webp), so
 * Vercel's optimizer is never invoked — the CDN already serves final webp.
 * blurDataURL comes from the DTO's lqip when the pipeline baked one.
 *
 * Renders nothing for URLs outside the image-host allowlist: supplier metadata
 * is attacker-writable, and this host must not hotlink arbitrary origins into
 * a page that renders next to an authenticity verdict.
 */
export function HeroImage({
  src,
  alt,
  lqip,
  priority = false,
}: {
  src: string;
  alt: string;
  lqip?: string;
  priority?: boolean;
}) {
  if (!isAllowedImageUrl(src)) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-surface"
      style={{ aspectRatio: "4 / 3" }}
    >
      <Image
        loader={mediaImageLoader}
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 480px) 100vw, 448px"
        priority={priority}
        className="object-contain"
        {...(lqip ? { placeholder: "blur" as const, blurDataURL: lqip } : {})}
      />
    </div>
  );
}
