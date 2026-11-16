import type { ReactNode } from "react";

import { COPY } from "@/lib/consumer-copy";
import type { RatingsView } from "@/lib/ratings-shared";

import { Section } from "./consumer";

const STAR_PATH =
  "m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8l-5.3 2.8 1.1-5.8-4.3-4.1 5.9-.8L12 3.5Z";

/** How much of star number `i` (1–5) is filled for a value: none, half or all. */
export function starFill(value: number, i: number): "full" | "half" | "none" {
  // To the nearest half, so 4.5 shows four and a half stars, not five.
  const halves = Math.round(value * 2) / 2;
  return halves >= i ? "full" : halves >= i - 0.5 ? "half" : "none";
}

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

/** "2026-10-12T08:00:00Z" → "Oct 12, 2026". Anything else is left out. */
export function reviewDay(iso: string): string | null {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(time));
}

/**
 * Reviews from verified owners: the average, how many, and the latest few.
 * Server-rendered. A reviewer is shown only as "Verified owner" — never by
 * their address (the owner of an item must not be identifiable from a public
 * page).
 */
export function RatingSummary({ view }: { view: RatingsView | null }) {
  if (!view || view.restricted) return null;
  const line = view.product && view.product.count > 0 ? view.product : view.item;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      {line.count === 0 || line.average === null ? (
        <p className="text-[15px] leading-[22px] text-body">{COPY.reviews.none}</p>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-[32px] font-bold leading-9">{line.average.toFixed(1)}</p>
          <div className="flex flex-col gap-0.5">
            <Stars value={line.average} />
            <p className="text-sm leading-5 text-muted">{COPY.reviews.count(line.count)}</p>
          </div>
        </div>
      )}
      <p className="text-sm leading-5 text-muted">{COPY.reviews.onlyOwners}</p>
      {view.reviews.length > 0 && (
        <ul className="flex flex-col divide-y divide-line border-t border-line">
          {view.reviews.slice(0, 3).map((r) => {
            const day = reviewDay(r.createdAt);
            return (
              <li key={r.id} className="flex flex-col gap-1 py-3 last:pb-0">
                <div className="flex items-center gap-2 text-[13px] leading-[18px] text-muted">
                  <Stars value={r.stars} size={14} />
                  <span>{COPY.reviews.verifiedOwner}</span>
                  {day && (
                    <time dateTime={r.createdAt} className="ml-auto">
                      {day}
                    </time>
                  )}
                </div>
                {r.review && <p className="text-sm leading-5 text-body">{r.review}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The "Owner reviews" section: the summary, then the page's "write a review"
 * control. Absent as a whole when there are no ratings to show for this item
 * (the read failed, or the owner keeps the item private) — never an empty
 * heading.
 */
export function ReviewsSection({
  view,
  write,
  late = false,
}: {
  view: RatingsView | null;
  write?: ReactNode;
  /**
   * True when the section is sent after the rest of the page. A browser with
   * scripts off cannot move it into place — it would sit below the footer —
   * so there it is left out instead.
   */
  late?: boolean;
}) {
  if (!view || view.restricted) return null;
  return (
    <Section title={COPY.reviews.title} needsScript={late}>
      <RatingSummary view={view} />
      {write}
    </Section>
  );
}
