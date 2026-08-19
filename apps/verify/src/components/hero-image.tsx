"use client";

import Image from "next/image";
import { isAllowedImageUrl, mediaImageLoader } from "@/lib/media";

/**
 * Product hero image for asset pages.
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
export function HeroImage({ src, alt, lqip }: { src: string; alt: string; lqip?: string }) {
  if (!isAllowedImageUrl(src)) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 mb-5 animate-fadeUp"
      style={{ aspectRatio: "4 / 3", background: "rgba(255,255,255,0.03)" }}
    >
      <Image
        loader={mediaImageLoader}
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 640px"
        className="object-contain"
        {...(lqip ? { placeholder: "blur" as const, blurDataURL: lqip } : {})}
      />
    </div>
  );
}
