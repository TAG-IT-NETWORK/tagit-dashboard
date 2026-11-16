import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { COPY, RECORD_STATES, type RecordStateKey } from "@/lib/consumer-copy";
import type { AssetLookup } from "@/lib/services";
import { recordPageModel } from "@/lib/tap-page";
import {
  OWNER,
  OWNER_SHORT,
  RATINGS,
  RECORD_NUMBER,
  RESTRICTED,
  REVIEWER,
  SELLER,
  STATE,
  record,
  recordDto,
} from "@/test-support/shopper-fixtures";
import { insideDrawer, outsideDrawer, readable } from "@/test-support/readable";

import { ReviewsSection } from "../rating-summary";
import { RecordResult } from "../record-result";

/**
 * TAP-T08: the record page (/asset/…) in each of its states, built the way
 * the route builds it (recordPageModel → <RecordResult>).
 *
 * Nobody tapped anything to get to this page, so it must never say the product
 * in the reader's hand is authentic.
 */

const CASES: Record<RecordStateKey, { lookup: AssetLookup | { kind: "invalid" }; id: string }> = {
  registered: { lookup: record(STATE.ACTIVATED, true), id: RECORD_NUMBER },
  notReleased: { lookup: record(STATE.BOUND), id: RECORD_NUMBER },
  reported: { lookup: record(STATE.FLAGGED), id: RECORD_NUMBER },
  retired: { lookup: record(STATE.RECYCLED), id: RECORD_NUMBER },
  privateItem: { lookup: RESTRICTED, id: RECORD_NUMBER },
  noRecord: { lookup: { kind: "none" }, id: "999" },
  notLoaded: { lookup: { kind: "unavailable" }, id: RECORD_NUMBER },
  notANumber: { lookup: { kind: "invalid" }, id: "abc" },
};

const STATES = Object.keys(CASES) as RecordStateKey[];

function page(state: RecordStateKey, lookup = CASES[state].lookup): string {
  const { id } = CASES[state];
  const model = recordPageModel(lookup, id);
  expect(model.state).toBe(state); // the data really leads to this state
  const { product } = model;
  const reviewable = model.stateCode === STATE.ACTIVATED || model.stateCode === STATE.CLAIMED;
  return renderToStaticMarkup(
    <RecordResult
      state={model.state}
      product={product}
      chips={model.chips}
      recordNumber={model.recordNumber}
      technical={model.technical}
      detailsCheck={model.detailsCheck}
      retryHref={`/asset/${id}`}
      jsonLd={model.jsonLd}
      slots={
        product
          ? {
              photo: product.photo ? (
                <img src={product.photo.url} alt={COPY.product.photoAlt(product.name)} />
              ) : undefined,
              buy: product.price ? (
                <button type="button">{COPY.buy.button(product.price)}</button>
              ) : undefined,
              reviews: reviewable ? <ReviewsSection view={RATINGS} /> : undefined,
              history: <p>(product history loads here)</p>,
            }
          : undefined
      }
    />,
  );
}

describe("what a reader sees on the record page, state by state", () => {
  it.each(STATES)("%s", (state) => {
    const text = readable(page(state));
    expect(text).toContain(`# ${RECORD_STATES[state].headline}`);
    expect(text).toContain(`${RECORD_STATES[state].line}.`);
    expect(text).toMatchSnapshot();
  });
});

describe("every record state", () => {
  it.each(STATES)(
    "%s has one headline, announced as a status, and the honest-status sentence",
    (state) => {
      const html = page(state);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toMatch(/<div role="status"[^>]*>[\s\S]*?<h1/);
      expect(html).toContain(COPY.honestStatus);
    },
  );

  it.each(STATES)("%s never says Authentic: nothing was checked here", (state) => {
    const text = readable(outsideDrawer(page(state)));
    expect(text).not.toMatch(/\bAuthentic\b/);
    expect(text).not.toContain(COPY.trust.title);
    expect(text).not.toMatch(/checked just now/i);
  });

  it.each(STATES)("%s shows no owner, seller or reviewer address anywhere", (state) => {
    // "anywhere" includes the structured-data block and the closed drawer
    const html = page(state);
    for (const secret of [
      OWNER,
      OWNER_SHORT,
      OWNER.slice(0, 8),
      SELLER,
      SELLER.slice(0, 8),
      REVIEWER,
    ]) {
      expect(html).not.toContain(secret);
    }
    expect(html.toLowerCase()).not.toContain(OWNER.toLowerCase());
  });

  it.each(STATES)("%s shows no address or state code outside Technical details", (state) => {
    const visible = outsideDrawer(page(state));
    expect(visible).not.toMatch(/0x[0-9a-fA-F]{4,}/);
    expect(visible).not.toMatch(/\b(NONE|MINTED|BOUND|ACTIVATED|CLAIMED|FLAGGED|RECYCLED)\b/);
    expect(readable(visible)).not.toMatch(/\(\d\)/);
  });

  it.each(STATES)("%s uses the shopper's words, not ours", (state) => {
    const text = readable(outsideDrawer(page(state)));
    for (const jargon of [
      /\btokens?\b/i,
      /\bNFC\b/,
      /\bchips?\b/i,
      /\bwallets?\b/i,
      /\bblockchain\b/i,
      /\bon-chain\b/i,
      /\bUSDC\b/,
      /\bSepolia\b/i,
      /\bmint(ed)?\b/i,
      /\bcounterfeit\b/i,
      /\bdigital twin\b/i,
    ]) {
      expect(text).not.toMatch(jargon);
    }
  });

  it.each(STATES)("%s keeps the drawer closed", (state) => {
    expect(page(state)).not.toMatch(/<details[^>]*\bopen\b/);
  });
});

describe("the structured-data block", () => {
  const blocks = (html: string) =>
    [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => m[1],
    );

  it("is on the page once, exactly as the builder made it", () => {
    const lookup = record(STATE.ACTIVATED, true);
    const model = recordPageModel(lookup, RECORD_NUMBER);
    const found = blocks(page("registered", lookup));
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(JSON.stringify(model.jsonLd));
  });

  it.each(["privateItem", "noRecord", "notLoaded", "notANumber"] as const)(
    "is left off the %s page",
    (state) => {
      expect(blocks(page(state))).toHaveLength(0);
    },
  );
});

describe("the parts each record state does and does not get", () => {
  const has = (state: RecordStateKey, text: string) => readable(page(state)).includes(text);

  it("shows product details only for a record that is public", () => {
    for (const state of ["registered", "notReleased", "reported", "retired"] as const) {
      expect(has(state, "Renewal Cream")).toBe(true);
    }
    for (const state of ["privateItem", "noRecord", "notLoaded", "notANumber"] as const) {
      expect(has(state, "Renewal Cream")).toBe(false);
      expect(has(state, "TAG IT Demo")).toBe(false);
    }
  });

  it("shows the price and the buy button only for a listed item", () => {
    expect(has("registered", COPY.buy.button("$23.33"))).toBe(true);
    const notListed = page("registered", record(STATE.ACTIVATED));
    expect(notListed).not.toContain("$23.33");
    expect(readable(notListed)).not.toContain(COPY.buy.buttonNoPrice);
    for (const state of STATES.filter((s) => s !== "registered")) {
      expect(page(state)).not.toContain("$23.33");
    }
  });

  it("shows no price and no buy button for an item that is reported, retired or not released, even if a listing is left on it", () => {
    for (const [state, code] of [
      ["reported", STATE.FLAGGED],
      ["retired", STATE.RECYCLED],
      ["notReleased", STATE.BOUND],
    ] as const) {
      const html = page(state, record(code, true));
      expect(readable(html)).not.toContain(COPY.buy.buttonNoPrice);
      expect(html).not.toContain("$23.33");
      expect(readable(html)).not.toContain(COPY.chips.forSale);
    }
  });

  it("holds the record number and the state code in the drawer", () => {
    const drawer = insideDrawer(page("registered"));
    for (const value of [RECORD_NUMBER, "ACTIVATED (3)", COPY.technical.networkValue]) {
      expect(drawer).toContain(value);
    }
    expect(drawer).toContain(COPY.technical.viewPublicRecord);
    // a link that is not a number has nothing technical to show
    expect(page("notANumber")).not.toContain("<details");
  });

  it("offers Try again only when the record did not load", () => {
    expect(page("notLoaded")).toContain(`href="/asset/${RECORD_NUMBER}"`);
    expect(has("notLoaded", COPY.actions.tryAgain)).toBe(true);
    expect(has("noRecord", COPY.actions.tryAgain)).toBe(false);
  });

  it("says a missing record is not a verdict on a product", () => {
    expect(has("noRecord", COPY.status.noRecordNote)).toBe(true);
    expect(has("noRecord", COPY.actions.backHome)).toBe(true);
  });

  it("explains how a check works, in general terms, on a public or private record", () => {
    expect(has("registered", `## ${COPY.howItWorks.title}`)).toBe(true);
    expect(has("privateItem", `## ${COPY.howItWorks.title}`)).toBe(true);
    expect(has("reported", `## ${COPY.howItWorks.title}`)).toBe(false);
  });

  it("warns when the product details do not match the brand's record", () => {
    const dto = recordDto(STATE.ACTIVATED, true);
    dto.verification = { ...dto.verification!, verified: false };
    const html = page("registered", { kind: "record", dto });
    expect(readable(html)).toContain(COPY.status.detailsNotConfirmed);
    expect(has("registered", COPY.status.detailsNotConfirmed)).toBe(false);
  });
});
