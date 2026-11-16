/**
 * What a shopper sees after a tap (TAP-T08): one verdict, then the product,
 * its status and one main action — in that order, in plain words.
 *
 * One component for all 12 approved states (see TAP_STATES in
 * @/lib/consumer-copy), shared by both tap routes (/sun and /01/…). It is
 * synchronous and takes plain values, so each state is rendered in the unit
 * tests exactly as it ships. Interactive parts (photo, buy button, reviews,
 * history) are handed in as ready-made elements.
 *
 * What never appears here: the owner's address anywhere; a tag ID, a state
 * code or a network name outside <TechnicalDetails>; the reason a check
 * failed. The page does not receive those values at all, except the ones the
 * caller puts in `technical`.
 */
import type { ReactNode } from "react";

import { COPY, TAP_STATES, supportMailto, type TapStateKey } from "@/lib/consumer-copy";
import {
  chipsFor,
  hasProductToShow,
  isAuthenticTapState,
  type DetailsCheck,
  type ProductView,
} from "@/lib/tap-view";

import { CheckingResolved, type CheckGlyph, type CheckProgress } from "./checking";
import { PriceApprox } from "./price-block";
import {
  ActionLink,
  Card,
  ConsumerPage,
  Facts,
  InfoRow,
  LinkRow,
  Note,
  ProductCard,
  Section,
  Steps,
  TechnicalDetails,
  VerdictBanner,
  type TechLink,
  type TechRow,
} from "./consumer";

/** The mark each state shows, on the banner and on the resolving frame. */
const STATE_GLYPH: Record<TapStateKey, CheckGlyph> = {
  newForSale: "check",
  newNotForSale: "check",
  owned: "check",
  privateItem: "check",
  notReleased: "clock",
  reported: "alert",
  retired: "info",
  checkFailed: "cross",
  linkUsed: "clock",
  noProduct: "info",
  ourSide: "alert",
  linkIncomplete: "alert",
};

/** States that have a product to show. */
const HAS_PRODUCT: ReadonlySet<TapStateKey> = new Set([
  "newForSale",
  "newNotForSale",
  "owned",
  "notReleased",
  "reported",
  "retired",
]);

export interface TapResultProps {
  state: TapStateKey;
  /** Product facts; ignored by the states that have no product to show. */
  product?: ProductView;
  /** The record number, for the subject line of a report. Never shown as text here. */
  recordNumber?: string;
  /** Everything technical. Rendered only inside the closed drawer. */
  technical?: { rows: TechRow[]; links: TechLink[] };
  /** How the product details compare with the brand's public record. */
  detailsCheck?: DetailsCheck;
  /** Why the item's details are not on the page, when they are not. */
  missingDetails?: "private" | "unavailable";
  /** This same tap again, for "Try again". */
  retryHref?: string;
  /** When set, the checking frame resolves over the page (see <CheckingResolved>). */
  progress?: CheckProgress;
  /** The tap's step durations, for the page's data-tap-timing attribute. */
  timing?: string;
  slots?: {
    /** The product photo. */
    photo?: ReactNode;
    /** The buy button. Offered by the page only for an item that is for sale. */
    buy?: ReactNode;
    /** The whole "Owner reviews" section (see <ReviewsSection>). */
    reviews?: ReactNode;
    /** Product history. */
    history?: ReactNode;
  };
}

function aboutFacts(product: ProductView): [string, string][] {
  const { facts } = COPY.about;
  return [
    ...(product.brand ? ([[facts.brand, product.brand]] as [string, string][]) : []),
    ...(product.model ? ([[facts.model, product.model]] as [string, string][]) : []),
    ...(product.madeIn ? ([[facts.madeIn, product.madeIn]] as [string, string][]) : []),
    ...(product.code ? ([[facts.code, product.code]] as [string, string][]) : []),
    ...(product.registeredOn
      ? ([[facts.registered, product.registeredOn]] as [string, string][])
      : []),
  ];
}

/** True when "About this product" has anything to say. */
function hasAbout(product: ProductView): boolean {
  return !!product.description || aboutFacts(product).length > 0;
}

/** "About this product": the brand's own words and the few facts we hold. */
export function AboutSection({ product }: { product: ProductView }) {
  const facts = aboutFacts(product);
  if (!hasAbout(product)) return null;
  return (
    <Section id="about" title={COPY.about.title}>
      {product.description && (
        <p className="whitespace-pre-line text-[15px] leading-[22px] text-body">
          {product.description}
        </p>
      )}
      <Facts rows={facts} />
    </Section>
  );
}

/** "How we know it's authentic": the three trust points, for a product that checked out. */
export function TrustSection({ brand }: { brand?: string }) {
  const [first, second, third] = COPY.trust.points;
  return (
    <Section id="how-we-know" title={COPY.trust.title}>
      <Steps
        tone="ok"
        items={[
          { title: first.title, body: first.body },
          { title: second.title, body: brand ? second.bodyWithBrand(brand) : second.body },
          { title: third.title, body: third.body },
        ]}
      />
    </Section>
  );
}

/**
 * "How the check works": the same ideas in general terms, for pages where
 * nothing was confirmed. It never says this item passed.
 */
export function HowItWorksSection() {
  return (
    <Section id="how-it-works" title={COPY.howItWorks.title}>
      <Steps items={COPY.howItWorks.points} />
    </Section>
  );
}

/** "Need help?" — one way to reach a person. */
export function HelpSection({ subject }: { subject: string }) {
  return (
    <Section title={COPY.help.title}>
      <Card>
        <LinkRow href={supportMailto(subject)} label={COPY.help.reportProblem} />
      </Card>
    </Section>
  );
}

export function TapResult({
  state,
  product,
  recordNumber,
  technical,
  detailsCheck,
  missingDetails,
  retryHref,
  progress,
  timing,
  slots = {},
}: TapResultProps) {
  const copy = TAP_STATES[state];
  const glyph = STATE_GLYPH[state];
  const productState = HAS_PRODUCT.has(state);
  const withProduct = productState && hasProductToShow(product);
  const authentic = isAuthenticTapState(state);

  return (
    <ConsumerPage timing={timing}>
      {progress && (
        <CheckingResolved
          tone={copy.tone}
          glyph={glyph}
          title={copy.headline}
          progress={progress}
        />
      )}

      <VerdictBanner tone={copy.tone} icon={glyph} headline={copy.headline} line={copy.line} />

      {withProduct && (
        <ProductCard
          name={product.name}
          price={state === "newForSale" ? product.price : undefined}
          priceNote={
            state === "newForSale" && product.fx ? <PriceApprox fx={product.fx} /> : undefined
          }
          basics={[
            ...(product.brand ? [product.brand] : []),
            ...(product.madeIn ? [COPY.product.madeIn(product.madeIn)] : []),
          ]}
          chips={chipsFor(state)}
          photo={slots.photo}
        />
      )}

      {withProduct && detailsCheck === "mismatch" && (
        <Note icon="alert">{COPY.status.detailsNotConfirmed}</Note>
      )}

      {/* The verdict stands on its own; say plainly why there is no product under it. */}
      {productState && missingDetails === "unavailable" && (
        <Note icon="about">{COPY.status.detailsUnavailable}</Note>
      )}
      {productState && missingDetails === "private" && (
        <Note icon="lock">{COPY.status.detailsPrivate}</Note>
      )}

      {/* ── What its status means, and the one main action ─────────────────── */}

      {/* Offered for an item that is for sale, and for a new item whose record
          did not load (its listing is not known; the widget asks for itself). */}
      {(state === "newForSale" ||
        (state === "newNotForSale" && missingDetails === "unavailable")) &&
        slots.buy}

      {(state === "newForSale" || state === "newNotForSale") && (
        <Card>
          <InfoRow icon="shield" title={COPY.status.newTitle} />
          <LinkRow href="#how-we-know" icon="about" label={COPY.status.howWeKnowLink} />
        </Card>
      )}

      {state === "owned" && (
        <Card>
          <InfoRow
            icon="people"
            title={COPY.status.secondHandTitle}
            body={COPY.status.secondHandBody}
          />
          <LinkRow href="#how-we-know" icon="about" label={COPY.status.howWeKnowLink} />
        </Card>
      )}

      {state === "notReleased" && <Note icon="about">{COPY.status.notReleasedTip}</Note>}

      {state === "noProduct" && <Note icon="about">{COPY.status.noProductTip}</Note>}

      {state === "reported" && (
        <>
          <Note icon="tag">{COPY.status.tagIsRealNote}</Note>
          <Section title={COPY.reported.meaningTitle}>
            <Card>
              {COPY.reported.meaning.map((line) => (
                <InfoRow key={line} icon="about" body={line} />
              ))}
            </Card>
          </Section>
          <Section title={COPY.reported.doTitle}>
            <Steps items={COPY.reported.steps.map((body) => ({ body }))} />
          </Section>
          <ActionLink kind="dark" href={supportMailto(COPY.mail.sighting(recordNumber))}>
            {COPY.actions.reportSighting}
          </ActionLink>
        </>
      )}

      {state === "checkFailed" && (
        <>
          <Section title={COPY.checkFailed.doTitle}>
            <Steps items={COPY.checkFailed.steps} />
          </Section>
          <Note icon="tag">{COPY.checkFailed.why}</Note>
          <ActionLink kind="dark" href={supportMailto(COPY.mail.checkFailed)}>
            {COPY.actions.reportProblem}
          </ActionLink>
        </>
      )}

      {state === "linkUsed" && (
        <>
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-5 py-7 text-center">
            <span className="text-ink">
              <svg
                viewBox="0 0 24 24"
                width="48"
                height="48"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M8 9c1.8 2 1.8 4 0 6" />
                <path d="M11.5 6.5c3.3 3.6 3.3 7.4 0 11" />
                <path d="M15 4c5 5.3 5 10.7 0 16" />
              </svg>
            </span>
            <h2 className="text-xl font-bold leading-[26px]">{COPY.linkUsed.againTitle}</h2>
            <p className="text-[15px] leading-[22px] text-body">{COPY.linkUsed.againBody}</p>
          </div>
          <Section title={COPY.linkUsed.whyTitle}>
            <Card>
              {COPY.linkUsed.why.map((line) => (
                <InfoRow key={line} icon="lock" body={line} />
              ))}
            </Card>
          </Section>
        </>
      )}

      {state === "linkIncomplete" && <Note icon="tag">{COPY.linkIncomplete.tip}</Note>}

      {state === "ourSide" && (
        <>
          {retryHref && (
            <ActionLink kind="primary" href={retryHref}>
              {COPY.actions.tryAgain}
            </ActionLink>
          )}
          <Note icon="about">{COPY.ourSide.tip}</Note>
        </>
      )}

      {(state === "newNotForSale" || state === "retired") && withProduct && hasAbout(product) && (
        <ActionLink href="#about">{COPY.actions.seeDetails}</ActionLink>
      )}

      {/* ── The rest of the page ───────────────────────────────────────────── */}

      {withProduct && <AboutSection product={product} />}

      {authentic && <TrustSection brand={withProduct ? product.brand : undefined} />}
      {(state === "checkFailed" || state === "linkUsed") && <HowItWorksSection />}

      {slots.reviews}

      {/* The list is loaded by the browser, so it is left out while scripts are off. */}
      {slots.history && (
        <Section title={COPY.history.title} needsScript>
          {slots.history}
        </Section>
      )}

      {/* A failed check already has "Report a problem" as its main action. */}
      {state !== "checkFailed" && <HelpSection subject={COPY.mail.tapHelp(recordNumber)} />}

      {technical && <TechnicalDetails rows={technical.rows} links={technical.links} />}
    </ConsumerPage>
  );
}
