import type { ReactNode } from "react";

import { COPY } from "@/lib/consumer-copy";
import type { RatingsView } from "@/lib/ratings-shared";

import { Row } from "./consumer";
import { NEEDS_SCRIPT } from "./shared";
import styles from "./stage.module.css";
import { Stars } from "./stars";

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

/** The rating a page leads with: the product's when it has one, else this item's. */
function ratingOf(view: RatingsView) {
  return view.product && view.product.count > 0 ? view.product : view.item;
}

/**
 * One line under the product's name: the stars, the average and how many
 * owners reviewed it. It is what a shopper wants from reviews first, so it is
 * on show without opening anything. Nothing at all while there are no reviews
 * (or none to show): a product is not marked down for being new.
 *
 * `late` is for a line sent after the rest of the page (the tap page): with
 * scripts off it cannot be moved into place, so there it is left out.
 */
export function RatingLine({ view, late = false }: { view: RatingsView | null; late?: boolean }) {
  if (!view || view.restricted) return null;
  const rating = ratingOf(view);
  if (rating.count === 0 || rating.average === null) return null;
  return (
    <p
      className={`flex flex-wrap items-center justify-center gap-x-2 pt-1 text-sm leading-5 text-muted${late ? ` ${styles.appear}` : ""}`}
      data-rating
      {...(late ? NEEDS_SCRIPT : {})}
    >
      <span className="inline-flex items-center gap-1.5">
        <Stars value={rating.average} size={16} />
        {/* The stars already say the number to a screen reader. */}
        <span className="font-semibold text-ink" aria-hidden="true">
          {rating.average.toFixed(1)}
        </span>
      </span>
      <span>{COPY.reviews.count(rating.count)}</span>
    </p>
  );
}

/**
 * Reviews from verified owners: the average, how many, and the latest few.
 * Server-rendered. A reviewer is shown only as "Verified owner" — never by
 * their address (the owner of an item must not be identifiable from a public
 * page).
 */
export function RatingSummary({ view }: { view: RatingsView | null }) {
  if (!view || view.restricted) return null;
  const rating = ratingOf(view);
  return (
    <div className="flex flex-col gap-3">
      {rating.count === 0 || rating.average === null ? (
        <p className="text-[15px] leading-[22px] text-body">{COPY.reviews.none}</p>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-[32px] font-bold leading-9">{rating.average.toFixed(1)}</p>
          <div className="flex flex-col gap-0.5">
            <Stars value={rating.average} />
            <p className="text-sm leading-5 text-muted">{COPY.reviews.count(rating.count)}</p>
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
 * What the reviews row holds: the average, who can review, the latest reviews
 * and the page's "write a review" control. When the reviews could not be read
 * it says so, and says nothing about whether there are any.
 *
 * `late` is for contents sent after the rest of the page (the tap page). A
 * browser with scripts off cannot move them into the row — they would sit
 * under the footer — so there they are left out.
 */
export function ReviewsContent({
  view,
  write,
  late = false,
}: {
  view: RatingsView | null;
  write?: ReactNode;
  late?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3" {...(late ? NEEDS_SCRIPT : {})}>
      {!view || view.restricted ? (
        <p className="text-sm leading-5 text-muted">{COPY.reviews.unavailable}</p>
      ) : (
        <>
          <RatingSummary view={view} />
          {write}
        </>
      )}
    </div>
  );
}

/** Lines in the shape of what is coming, for a row opened before its reviews are in. */
export function ReviewsLoading() {
  return (
    <div {...NEEDS_SCRIPT}>
      <div className="flex flex-col gap-3 py-1" aria-hidden="true">
        <div className="h-8 w-2/5 rounded bg-surface" />
        <div className="h-3.5 w-full rounded bg-surface" />
        <div className="h-3.5 w-3/4 rounded bg-surface" />
      </div>
      <p className="sr-only">{COPY.reviews.loadingList}</p>
    </div>
  );
}

/**
 * The "Owner reviews" row. On the tap page the row is part of the page from
 * the first moment and only its contents arrive later (see <TapVerdict>), so
 * nothing on the page moves when they do. `needsScript` is for that case:
 * with scripts off the contents can never arrive, so the row is left out.
 */
export function ReviewsRow({
  needsScript = false,
  children,
}: {
  needsScript?: boolean;
  children: ReactNode;
}) {
  return (
    <Row name="reviews" icon="star" title={COPY.reviews.title} needsScript={needsScript}>
      {children}
    </Row>
  );
}

/**
 * The row with its contents, for a page that has read the reviews before it
 * renders (the record page). Absent as a whole when there are no ratings to
 * show for this item (the read failed, or the owner keeps the item private) —
 * never an empty heading.
 */
export function ReviewsSection({ view, write }: { view: RatingsView | null; write?: ReactNode }) {
  if (!view || view.restricted) return null;
  return (
    <ReviewsRow>
      <ReviewsContent view={view} write={write} />
    </ReviewsRow>
  );
}
