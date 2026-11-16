/**
 * The finished tap, for both tap routes (/sun and /01/…).
 *
 * This is the server half: it waits for the run (the checking frame shows
 * meanwhile), asks @/lib/tap-page what the page may show, and hands that to
 * <TapResult> together with the interactive parts. All wording and layout live
 * in <TapResult>; all decisions about authenticity live in @/lib/resolve.
 *
 * WHAT IS DELIBERATELY NOT PASSED ON. The run knows the owner's address and
 * the reason a failed check failed. Neither leaves @/lib/tap-page: the model
 * it returns simply has no field for them.
 */
import "server-only";

import { Suspense } from "react";

import { COPY } from "@/lib/consumer-copy";
import type { RatingsView } from "@/lib/ratings";
import type { AssetLookup } from "@/lib/services";
import { startTapLookups, type TapLookups } from "@/lib/tap-lookups";
import { tapPageModel, type TechLink, type TechRow } from "@/lib/tap-page";
import type { TapRun } from "@/lib/tap-run";
import { logTap } from "@/lib/tap-timing";

import { BuyWidget } from "./buy-widget";
import { HeroImage } from "./hero-image";
import { ProvenanceTimeline } from "./provenance-timeline";
import { RateWidget } from "./rate-widget";
import { ReviewsSection } from "./rating-summary";
import { TapResult } from "./tap-result";

/** Reviews arrive after the verdict; the section streams in when they land. */
async function Reviews({
  ratings,
  tokenId,
  productName,
}: {
  ratings: Promise<RatingsView | null>;
  tokenId: string;
  productName: string;
}) {
  return (
    <ReviewsSection
      view={await ratings}
      write={<RateWidget tokenId={tokenId} productName={productName} />}
    />
  );
}

export async function TapVerdict({
  run,
  route,
  retryHref,
  extra,
}: {
  run: TapRun<TapLookups>;
  /** The route's name in the tap log, e.g. "/sun". */
  route: string;
  /** This same tap again. */
  retryHref: string;
  /**
   * Route-specific technical rows and links (the GS1 route adds its own). The
   * links are built once the record number is known; it is null when the tap
   * did not lead to an item.
   */
  extra?: { rows: TechRow[]; links: (recordNumber: string | null) => TechLink[] };
}) {
  const { timer } = run;
  const res = await run.resolution;

  // The item record was requested when the tag resolved; the fallback only
  // runs if that callback somehow did not fire.
  let lookup: AssetLookup | null = null;
  let ratings: Promise<RatingsView | null> | null = null;
  if (res.kind === "resolved") {
    const lookups = run.item() ?? startTapLookups(res.tokenId.toString(), timer);
    lookup = await lookups.product;
    // NOT awaited: reviews stream in below and never hold the verdict back.
    ratings = lookups.ratings;
  }
  logTap(route, res.kind, timer);

  const model = tapPageModel({
    res,
    lookup,
    stepsSeen: run.stepsSeen(),
    tookMs: timer.spans().total ?? 0,
    extra,
  });
  const { product, recordNumber: tokenId } = model;

  return (
    <TapResult
      state={model.state}
      product={product}
      recordNumber={tokenId}
      technical={model.technical}
      detailsCheck={model.detailsCheck}
      missingDetails={model.missingDetails}
      retryHref={retryHref}
      progress={model.progress}
      timing={timer.header()}
      slots={
        product && tokenId
          ? {
              photo: product.photo ? (
                <HeroImage
                  src={product.photo.url}
                  alt={COPY.product.photoAlt(product.name)}
                  lqip={product.photo.lqip}
                  priority
                />
              ) : undefined,
              // Price comes from the pricing API inside the widget; it hides
              // itself when there is no live listing.
              buy: model.show.buy ? (
                <BuyWidget tokenId={tokenId} productName={product.name} />
              ) : undefined,
              reviews:
                ratings && model.show.reviews ? (
                  <Suspense fallback={null}>
                    <Reviews ratings={ratings} tokenId={tokenId} productName={product.name} />
                  </Suspense>
                ) : undefined,
              history: model.show.history ? (
                <ProvenanceTimeline tokenId={tokenId} brand={product.brand} />
              ) : undefined,
            }
          : undefined
      }
    />
  );
}
