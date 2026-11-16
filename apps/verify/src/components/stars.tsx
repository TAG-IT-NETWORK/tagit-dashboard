"use client";

/**
 * A client module for the same reason as ./consumer (see the note there): a
 * row of stars is ten drawings, and drawn by a server component each of them
 * was sent twice. It takes a number and a size, nothing else.
 */
import { COPY } from "@/lib/consumer-copy";
import { starFill } from "@/lib/ratings-shared";

const STAR_PATH =
  "m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8l-5.3 2.8 1.1-5.8-4.3-4.1 5.9-.8L12 3.5Z";

/**
 * Stars. The value is also spelled out for assistive technology; the glyphs
 * themselves are decoration.
 */
export function Stars({ value, size = 18 }: { value: number | null; size?: number }) {
  const v = value ?? 0;
  return (
    <span
      role="img"
      aria-label={value === null ? COPY.reviews.none : COPY.reviews.starsLabel(value)}
      className="inline-flex gap-0.5 align-middle"
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = starFill(v, i);
        return (
          <span key={i} className="relative inline-flex" data-star={fill}>
            <svg
              viewBox="0 0 24 24"
              width={size}
              height={size}
              aria-hidden="true"
              className="text-line-strong"
            >
              <path fill="currentColor" d={STAR_PATH} />
            </svg>
            {fill !== "none" && (
              <svg
                viewBox="0 0 24 24"
                width={size}
                height={size}
                aria-hidden="true"
                className="absolute inset-0 text-[#b45309]"
                style={fill === "half" ? { clipPath: "inset(0 50% 0 0)" } : undefined}
              >
                <path fill="currentColor" d={STAR_PATH} />
              </svg>
            )}
          </span>
        );
      })}
    </span>
  );
}
