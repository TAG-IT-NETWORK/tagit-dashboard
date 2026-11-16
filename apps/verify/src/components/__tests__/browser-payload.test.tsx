import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { COPY } from "@/lib/consumer-copy";
import type { AssetLookup } from "@/lib/services";
import type { TapResolution } from "@/lib/resolve";
import { recordPageModel, tapPageModel } from "@/lib/tap-page";
import {
  BROKEN_LOOKUP_TAP,
  FAILED_TAP,
  FAIL_REASON,
  LOOKUP_ERROR,
  OWNER,
  OWNER_SHORT,
  RATINGS,
  RECORD_NUMBER,
  RESTRICTED,
  REVIEWER,
  SELLER,
  STATE,
  UNLINKED_TAP,
  record,
  recordWithFacts,
  resolvedTap,
} from "@/test-support/shopper-fixtures";

import * as consumer from "../consumer";
import {
  RatingLine,
  ReviewsContent,
  ReviewsLoading,
  ReviewsRow,
  ReviewsSection,
} from "../rating-summary";
import { RecordResult } from "../record-result";
import { Stars } from "../stars";
import { TapResult } from "../tap-result";

/**
 * What a page hands to the browser beside its HTML.
 *
 * The page's building blocks (../consumer, ../stars) are client components.
 * Every prop given to a client component is sent to the browser as data,
 * whether the component shows it or not. A server component is different:
 * only what it renders is sent. So a value that must never reach a shopper's
 * browser (an owner's, seller's or reviewer's address, the reason a check
 * failed) must never be a prop of a client component, not even one it
 * ignores.
 *
 * `handed` works out exactly that set for a page: it runs the server
 * components (they are plain functions), stops at each client component and
 * collects everything in its props, and follows the elements inside those
 * props. The tests then look for the secrets in it. The HTML itself is
 * checked in tap-result.test.tsx and record-result.test.tsx.
 */
const CLIENT_COMPONENTS = new Set<unknown>([
  ...Object.values(consumer).filter((value) => typeof value === "function"),
  Stars,
]);

function handed(node: unknown, out: unknown[] = []): unknown[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(node);
    return out;
  }
  if (typeof node === "function") {
    throw new Error("a function cannot be handed to the browser");
  }
  if (Array.isArray(node)) {
    for (const item of node) handed(item, out);
    return out;
  }
  if (isValidElement(node)) {
    const { type, props } = node as ReactElement<Record<string, unknown>>;
    if (typeof type === "function" && !CLIENT_COMPONENTS.has(type)) {
      // A server component: it runs on the server, and only its result travels.
      return handed((type as (props: unknown) => ReactNode)(props), out);
    }
    // A client component or a plain element: every prop travels.
    for (const [name, value] of Object.entries(props)) {
      // Markup set as a string is part of the HTML (the JSON-LD block, the
      // noscript rule); it is checked there.
      if (name === "dangerouslySetInnerHTML") continue;
      handed(value, out);
    }
    return out;
  }
  if (typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) handed(value, out);
    return out;
  }
  return out;
}

const payload = (page: ReactElement) => JSON.stringify(handed(page));

const SECRETS = [
  OWNER,
  OWNER_SHORT,
  OWNER.slice(0, 8),
  SELLER,
  SELLER.slice(0, 8),
  REVIEWER,
  FAIL_REASON,
  LOOKUP_ERROR,
];

const TAPS: Record<string, { res: TapResolution; lookup: AssetLookup | null }> = {
  newForSale: { res: resolvedTap(STATE.ACTIVATED), lookup: recordWithFacts(STATE.ACTIVATED, true) },
  newNotForSale: { res: resolvedTap(STATE.ACTIVATED), lookup: record(STATE.ACTIVATED) },
  owned: { res: resolvedTap(STATE.CLAIMED), lookup: recordWithFacts(STATE.CLAIMED) },
  // an owned item its owner listed again: the record carries a seller and a price
  ownedAndListed: { res: resolvedTap(STATE.CLAIMED), lookup: record(STATE.CLAIMED, true) },
  notReleased: { res: resolvedTap(STATE.BOUND), lookup: record(STATE.BOUND) },
  reported: { res: resolvedTap(STATE.FLAGGED), lookup: record(STATE.FLAGGED) },
  retired: { res: resolvedTap(STATE.RECYCLED), lookup: record(STATE.RECYCLED) },
  checkFailed: { res: FAILED_TAP, lookup: null },
  noProduct: { res: UNLINKED_TAP, lookup: null },
  ourSide: { res: BROKEN_LOOKUP_TAP, lookup: null },
  linkIncomplete: { res: { kind: "bad-params" }, lookup: null },
  privateItem: { res: resolvedTap(STATE.CLAIMED), lookup: RESTRICTED },
  recordDidNotLoad: { res: resolvedTap(STATE.ACTIVATED), lookup: { kind: "unavailable" } },
};

/** A tap page as <TapVerdict> builds it, with the real rating line and reviews row. */
function tapPage(name: string): ReactElement {
  const model = tapPageModel({ ...TAPS[name]!, stepsSeen: 1, tookMs: 250 });
  const { product } = model;
  return (
    <TapResult
      state={model.state}
      product={product}
      recordNumber={model.recordNumber}
      technical={model.technical}
      detailsCheck={model.detailsCheck}
      missingDetails={model.missingDetails}
      retryHref="/sun?picc=AA&cmac=BB"
      progress={model.progress}
      timing="sdm;dur=0.2, total;dur=250.0"
      slots={
        product
          ? {
              photo: product.photo ? <img src={product.photo.url} alt="" /> : undefined,
              rating: model.show.reviews ? <RatingLine view={RATINGS} late /> : undefined,
              reviews: model.show.reviews ? (
                <ReviewsRow needsScript>
                  <ReviewsContent view={RATINGS} late />
                </ReviewsRow>
              ) : undefined,
              history: model.show.history ? <p>(history)</p> : undefined,
            }
          : undefined
      }
    />
  );
}

const RECORDS: Record<string, { lookup: AssetLookup | { kind: "invalid" }; id: string }> = {
  registered: { lookup: recordWithFacts(STATE.ACTIVATED, true), id: RECORD_NUMBER },
  owned: { lookup: record(STATE.CLAIMED, true), id: RECORD_NUMBER },
  reported: { lookup: record(STATE.FLAGGED), id: RECORD_NUMBER },
  privateItem: { lookup: RESTRICTED, id: RECORD_NUMBER },
  noRecord: { lookup: { kind: "none" }, id: "999" },
  notLoaded: { lookup: { kind: "unavailable" }, id: RECORD_NUMBER },
  notANumber: { lookup: { kind: "invalid" }, id: "abc" },
};

function recordPage(name: string): ReactElement {
  const { lookup, id } = RECORDS[name]!;
  const model = recordPageModel(lookup, id);
  return (
    <RecordResult
      state={model.state}
      product={model.product}
      chips={model.chips}
      recordNumber={model.recordNumber}
      technical={model.technical}
      detailsCheck={model.detailsCheck}
      retryHref={`/asset/${id}`}
      jsonLd={model.jsonLd}
      slots={
        model.product
          ? {
              rating: <RatingLine view={RATINGS} />,
              reviews: <ReviewsSection view={RATINGS} />,
              history: <p>(history)</p>,
            }
          : undefined
      }
    />
  );
}

describe("the fixtures do hold what must not travel", () => {
  it("an owner, a seller, a reviewer and a failure reason are in the data the pages are built from", () => {
    // Otherwise "it is not in the payload" below would prove nothing.
    const source = JSON.stringify(
      [TAPS, RATINGS, { reason: FAIL_REASON, error: LOOKUP_ERROR }],
      (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
    );
    for (const secret of [OWNER, SELLER, REVIEWER, FAIL_REASON]) expect(source).toContain(secret);
  });
});

describe("what a tap page hands to the browser", () => {
  it.each(Object.keys(TAPS))(
    "%s: no owner, seller or reviewer address, and no failure reason",
    (name) => {
      const sent = payload(tapPage(name));
      for (const secret of SECRETS) expect(sent, secret).not.toContain(secret);
      expect(sent.toLowerCase()).not.toContain(OWNER.toLowerCase());
    },
  );

  it("does hand over what the page shows, so the check above is looking at the right thing", () => {
    const sent = payload(tapPage("owned"));
    // (A row's own title is not among these: the component brings its own words.)
    for (const shown of [
      "Renewal Cream",
      "Authentic",
      COPY.technical.recordNumber,
      RECORD_NUMBER,
      "Soaks in fast and lasts all day.",
    ]) {
      expect(sent).toContain(shown);
    }
  });

  it("hands over a review's stars and words, and nothing about who wrote it", () => {
    const sent = handed(
      <ReviewsRow needsScript>
        <ReviewsContent view={RATINGS} late />
      </ReviewsRow>,
    );
    const text = JSON.stringify(sent);
    expect(text).toContain(COPY.reviews.verifiedOwner);
    expect(text).not.toContain(REVIEWER);
    // The reviews themselves (objects with a `rater`) are never a prop of a
    // client component: only strings and numbers come out of the server side.
    expect(sent.every((value) => typeof value === "string" || typeof value === "number")).toBe(
      true,
    );
    expect(JSON.stringify(handed(<RatingLine view={RATINGS} late />))).not.toContain(REVIEWER);
    expect(JSON.stringify(handed(<ReviewsSection view={RATINGS} />))).not.toContain(REVIEWER);
    expect(handed(<ReviewsLoading />).join(" ")).not.toMatch(/0x/);
  });
});

describe("what a record page hands to the browser", () => {
  it.each(Object.keys(RECORDS))("%s: no owner, seller or reviewer address", (name) => {
    const sent = payload(recordPage(name));
    for (const secret of SECRETS) expect(sent, secret).not.toContain(secret);
    expect(sent.toLowerCase()).not.toContain(OWNER.toLowerCase());
  });
});

describe("the check itself", () => {
  it("sees a secret handed to a client component, shown or not", () => {
    // `title` is shown; a made-up extra prop is not. Both travel.
    const shown = <consumer.Tip icon="lock" title={OWNER} />;
    expect(payload(shown)).toContain(OWNER);
    const Leaky = consumer.Group as unknown as (props: Record<string, unknown>) => ReactNode;
    expect(payload(<Leaky order={0} record={{ owner: OWNER }} />)).toContain(OWNER);
  });

  it("does not count what a server component is given and does not render", () => {
    function ServerOnly({ secret, shown }: { secret: string; shown: string }) {
      void secret;
      return <consumer.Note>{shown}</consumer.Note>;
    }
    const sent = payload(<ServerOnly secret={OWNER} shown="fine" />);
    expect(sent).toContain("fine");
    expect(sent).not.toContain(OWNER);
  });

  it("knows the page's building blocks as client components", () => {
    for (const component of [
      consumer.Row,
      consumer.ProductCard,
      consumer.Verdict,
      consumer.TechnicalDetails,
      Stars,
    ]) {
      expect(CLIENT_COMPONENTS.has(component)).toBe(true);
    }
    // …and the reviews as server ones: that is what keeps a reviewer's address at home
    for (const component of [ReviewsSection, ReviewsContent, RatingLine, TapResult, RecordResult]) {
      expect(CLIENT_COMPONENTS.has(component)).toBe(false);
    }
  });
});
