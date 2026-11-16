/**
 * The record page (/asset/…) as a shopper sees it (TAP-T08).
 *
 * Same blocks and the same rules as the tap page (see ./tap-result), with one
 * difference that matters: nobody tapped anything to get here. A link can be
 * copied and forwarded, so this page says what the brand's record says and
 * asks the reader to tap the tag — it never claims the product in their hand
 * was checked. That is why its headline is not "Authentic".
 *
 * Synchronous, plain values in: every state is rendered in the unit tests.
 */
import type { ReactNode } from "react";

import { COPY, RECORD_STATES, type RecordStateKey } from "@/lib/consumer-copy";
import { hasProductToShow, type DetailsCheck, type ProductView } from "@/lib/tap-view";

import {
  ActionLink,
  ConsumerPage,
  Note,
  ProductCard,
  Section,
  TechnicalDetails,
  VerdictBanner,
  type IconName,
  type TechLink,
  type TechRow,
} from "./consumer";
import { PriceApprox } from "./price-block";
import { AboutSection, HelpSection, HowItWorksSection } from "./tap-result";

const STATE_ICON: Record<RecordStateKey, IconName> = {
  registered: "info",
  notReleased: "clock",
  reported: "alert",
  retired: "info",
  privateItem: "lock",
  noRecord: "info",
  notLoaded: "alert",
  notANumber: "alert",
};

const HAS_PRODUCT: ReadonlySet<RecordStateKey> = new Set([
  "registered",
  "notReleased",
  "reported",
  "retired",
]);

export interface RecordResultProps {
  state: RecordStateKey;
  product?: ProductView;
  /** Status chips for the product card (see recordChips in @/lib/tap-view). */
  chips?: string[];
  /** The record number, for the subject line of a report. */
  recordNumber?: string;
  /** Everything technical. Rendered only inside the closed drawer. */
  technical?: { rows: TechRow[]; links: TechLink[] };
  detailsCheck?: DetailsCheck;
  /** This page again, for "Try again". */
  retryHref?: string;
  /** The page's one structured-data block, placed first, exactly as built. */
  jsonLd?: Record<string, unknown> | null;
  slots?: {
    photo?: ReactNode;
    /** The buy button. The page offers it only for an item that is for sale. */
    buy?: ReactNode;
    /** The whole "Owner reviews" section (see <ReviewsSection>). */
    reviews?: ReactNode;
    history?: ReactNode;
  };
}

export function RecordResult({
  state,
  product,
  chips = [],
  recordNumber,
  technical,
  detailsCheck,
  retryHref,
  jsonLd,
  slots = {},
}: RecordResultProps) {
  const copy = RECORD_STATES[state];
  const withProduct = HAS_PRODUCT.has(state) && hasProductToShow(product);
  const reference = recordNumber ? ` (record ${recordNumber})` : "";

  return (
    <ConsumerPage>
      {/* ONE JSON-LD block per page — the www.tagit.network convention. */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <VerdictBanner
        tone={copy.tone}
        icon={STATE_ICON[state]}
        headline={copy.headline}
        line={copy.line}
      />

      {withProduct && (
        <ProductCard
          name={product.name}
          // A price is shown only where the item can be on sale: never next to
          // a warning, even if a listing was left on the record.
          price={state === "registered" ? product.price : undefined}
          priceNote={
            state === "registered" && product.fx ? <PriceApprox fx={product.fx} /> : undefined
          }
          basics={[
            ...(product.brand ? [product.brand] : []),
            ...(product.madeIn ? [COPY.product.madeIn(product.madeIn)] : []),
          ]}
          chips={chips}
          photo={slots.photo}
        />
      )}

      {withProduct && detailsCheck === "mismatch" && (
        <Note icon="alert">{COPY.status.detailsNotConfirmed}</Note>
      )}

      {state === "registered" && slots.buy}

      {state === "noRecord" && <Note icon="about">{COPY.status.noRecordNote}</Note>}

      {state === "notLoaded" && retryHref && (
        <ActionLink kind="primary" href={retryHref}>
          {COPY.actions.tryAgain}
        </ActionLink>
      )}

      {(state === "noRecord" || state === "notANumber") && (
        <ActionLink href="/">{COPY.actions.backHome}</ActionLink>
      )}

      {withProduct && <AboutSection product={product} />}

      {(state === "registered" || state === "privateItem") && <HowItWorksSection />}

      {/* Reviews sit with a product that is on sale or owned, as on the tap page;
          not under a warning and not before the item is released. */}
      {state === "registered" && slots.reviews}

      {/* The list is loaded by the browser, so it is left out while scripts are off. */}
      {slots.history && (
        <Section title={COPY.history.title} needsScript>
          {slots.history}
        </Section>
      )}

      <HelpSection subject={`Help with a product record${reference}`} />

      {technical && <TechnicalDetails rows={technical.rows} links={technical.links} />}
    </ConsumerPage>
  );
}
