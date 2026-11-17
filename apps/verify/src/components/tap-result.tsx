/**
 * What a shopper sees after a tap (TAP-T08): one verdict, then the product,
 * its status and one main action — in that order, in plain words. Everything
 * after that (reviews, product details, history, how the check works,
 * technical details) is a row that opens when asked for.
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
  productBasics,
  type DetailsCheck,
  type ProductView,
} from "@/lib/tap-view";

import { CheckingResolved, paceOf, type CheckProgress } from "./checking";
import { PriceApprox } from "./price-block";
import {
  ActionLink,
  BrandText,
  Card,
  ConsumerPage,
  Facts,
  Group,
  InfoRow,
  Note,
  ProductCard,
  Row,
  Section,
  Steps,
  TechnicalDetails,
  Tip,
  Verdict,
  type IconName,
  type TechLink,
  type TechRow,
} from "./consumer";

/** The mark each state's verdict carries. */
const STATE_GLYPH: Record<TapStateKey, IconName> = {
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

/**
 * States whose line says the check was made just now. On an earlier check
 * opened again, that line is replaced (see COPY.repeat).
 */
const SAYS_JUST_NOW: ReadonlySet<TapStateKey> = new Set(["newForSale", "newNotForSale"]);

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
  /**
   * Set when the same phone opened this check again (TAP-T10): the whole
   * minutes since it first did. The page then says it is an earlier check,
   * and no line on it reads as checked just now.
   */
  repeat?: { minutesAgo: number };
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
    /** The owners' rating, as one line under the product's name (see <RatingLine>). */
    rating?: ReactNode;
    /** The whole "Owner reviews" row (see <ReviewsSection>). */
    reviews?: ReactNode;
    /** Product history. */
    history?: ReactNode;
  };
}

/**
 * The short facts, label and value, in the order a shopper asks: what it is,
 * where it is from, which batch, how long it keeps, when its record last changed.
 * The brand's own facts (TAP-T09: size, batch, dates, use within) sit among
 * the ones the record always had.
 */
function aboutFacts(product: ProductView): [string, string][] {
  const labels = COPY.about.facts;
  const brandFacts = product.facts;
  const row = (label: string, value: string | undefined): [string, string][] =>
    value ? [[label, value]] : [];
  return [
    ...row(labels.brand, product.brand),
    ...row(labels.model, product.model),
    ...row(labels.size, brandFacts?.size),
    ...row(labels.madeIn, product.madeIn),
    ...row(labels.code, product.code),
    ...row(labels.batch, brandFacts?.batch),
    ...row(labels.madeOn, brandFacts?.madeOn),
    ...row(labels.bestBefore, brandFacts?.bestBefore),
    ...row(labels.useWithin, brandFacts?.useWithin),
    ...row(labels.updated, product.updatedOn),
  ];
}

/**
 * What the record says about the product, as rows that open: "About this
 * product" (the brand's description and the short facts), then one row for
 * each longer text a brand can write (TAP-T09): how to use, warnings,
 * ingredients. A row is there only when it has something in it.
 *
 * All of it is brand-written and shown as plain text (REQ-S-10): text nodes
 * only, nothing parsed, nothing linked.
 */
export function ProductRows({ product }: { product: ProductView }) {
  const facts = aboutFacts(product);
  const brandFacts = product.facts;
  return (
    <>
      {(product.description || facts.length > 0) && (
        <Row name="about" icon="list" title={COPY.about.title}>
          {product.description && (
            <p className="whitespace-pre-line break-words text-[15px] leading-[22px] text-body">
              {product.description}
            </p>
          )}
          <Facts rows={facts} />
        </Row>
      )}
      {brandFacts?.howToUse && (
        <Row name="how-to-use" icon="drop" title={COPY.about.howToUse}>
          <BrandText>{brandFacts.howToUse}</BrandText>
        </Row>
      )}
      {brandFacts?.warnings && (
        <Row name="warnings" icon="warning" title={COPY.about.warnings}>
          <BrandText>{brandFacts.warnings}</BrandText>
        </Row>
      )}
      {brandFacts?.ingredients && (
        <Row name="ingredients" icon="flask" title={COPY.about.ingredients}>
          <BrandText>{brandFacts.ingredients}</BrandText>
        </Row>
      )}
    </>
  );
}

/** "How we know it's authentic": the three trust points, for a product that checked out. */
export function TrustRow({ brand }: { brand?: string }) {
  const [first, second, third] = COPY.trust.points;
  return (
    <Row name="how-we-know" icon="shield" title={COPY.trust.title}>
      <Steps
        bare
        tone="ok"
        items={[
          { title: first.title, body: first.body },
          { title: second.title, body: brand ? second.bodyWithBrand(brand) : second.body },
          { title: third.title, body: third.body },
        ]}
      />
    </Row>
  );
}

/**
 * "How the check works": the same ideas in general terms, for pages where
 * nothing was confirmed. It never says this item passed.
 */
export function HowItWorksRow() {
  return (
    <Row name="how-it-works" icon="shield" title={COPY.howItWorks.title}>
      <Steps bare items={COPY.howItWorks.points} />
    </Row>
  );
}

/** "Product history": the list is loaded by the browser, so it is left out while scripts are off. */
export function HistoryRow({ children }: { children: ReactNode }) {
  return (
    <Row name="history" icon="clock" title={COPY.history.title} needsScript>
      {children}
    </Row>
  );
}

/** "Need help?" — one way to reach a person. */
export function Help({ subject }: { subject: string }) {
  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <h2 className="text-[15px] font-semibold leading-[22px]">{COPY.help.title}</h2>
      <a
        href={supportMailto(subject)}
        className="inline-flex min-h-[44px] items-center px-3 text-[15px] font-semibold leading-[22px] text-brand-link underline underline-offset-2"
      >
        {COPY.help.reportProblem}
      </a>
    </div>
  );
}

export function TapResult({
  state,
  product,
  recordNumber,
  technical,
  detailsCheck,
  missingDetails,
  repeat,
  retryHref,
  progress,
  timing,
  slots = {},
}: TapResultProps) {
  const copy = TAP_STATES[state];
  const productState = HAS_PRODUCT.has(state);
  const withProduct = productState && hasProductToShow(product);
  const authentic = isAuthenticTapState(state);

  return (
    <ConsumerPage
      timing={timing}
      tone={copy.tone}
      entrance={progress ? "settle" : "appear"}
      pace={progress ? paceOf(progress.tookMs) : undefined}
    >
      {progress && <CheckingResolved progress={progress} opening={copy.tone === "ok"} />}

      <Verdict
        tone={copy.tone}
        icon={STATE_GLYPH[state]}
        headline={copy.headline}
        line={repeat && SAYS_JUST_NOW.has(state) ? COPY.repeat.line : copy.line}
      />

      {/* ── What it is: photo, name, price ─────────────────────────────────── */}
      <Group order={0}>
        {/* An earlier check, opened again by the same phone: say so first. */}
        {repeat && <Note icon="clock">{COPY.repeat.note(repeat.minutesAgo)}</Note>}

        {withProduct && (
          <ProductCard
            name={product.name}
            price={state === "newForSale" ? product.price : undefined}
            priceNote={
              state === "newForSale" && product.fx ? <PriceApprox fx={product.fx} /> : undefined
            }
            basics={productBasics(product)}
            rating={slots.rating}
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
      </Group>

      {/* ── What its status means, and the one main action ─────────────────── */}
      <Group order={1}>
        {/* Offered for an item that is for sale, and for a new item whose record
            did not load (its listing is not known; the widget asks for itself). */}
        {(state === "newForSale" ||
          (state === "newNotForSale" && missingDetails === "unavailable")) &&
          slots.buy}

        {(state === "newForSale" || state === "newNotForSale") && (
          <Tip icon="shield" title={COPY.status.newTitle} />
        )}

        {state === "owned" && (
          <Tip
            icon="people"
            title={COPY.status.secondHandTitle}
            body={COPY.status.secondHandBody}
          />
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
      </Group>

      {/* ── More, when asked for: reviews first, then what the record holds ── */}
      <Group order={2}>
        {slots.reviews}

        {withProduct && <ProductRows product={product} />}

        {slots.history && <HistoryRow>{slots.history}</HistoryRow>}

        {authentic && <TrustRow brand={withProduct ? product.brand : undefined} />}
        {(state === "checkFailed" || state === "linkUsed") && <HowItWorksRow />}

        {technical && <TechnicalDetails rows={technical.rows} links={technical.links} />}

        {/* A failed check already has "Report a problem" as its main action. */}
        {state !== "checkFailed" && <Help subject={COPY.mail.tapHelp(recordNumber)} />}
      </Group>
    </ConsumerPage>
  );
}
