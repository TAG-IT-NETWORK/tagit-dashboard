import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { COPY, TAP_STATES, type TapStateKey } from "@/lib/consumer-copy";
import type { AssetLookup } from "@/lib/services";
import type { TapResolution } from "@/lib/resolve";
import { tapPageModel } from "@/lib/tap-page";
import {
  BROKEN_LOOKUP_TAP,
  FAILED_TAP,
  FAIL_REASON,
  FINGERPRINT,
  LOOKUP_ERROR,
  OWNER,
  OWNER_SHORT,
  RATINGS,
  RECORD_NUMBER,
  RESTRICTED,
  REVIEWER,
  SELLER,
  STATE,
  TAG_ID_SHOWN,
  TAG_UID,
  UNLINKED_TAP,
  record,
  resolvedTap,
} from "@/test-support/shopper-fixtures";
import { insideDrawer, outsideDrawer, readable } from "@/test-support/readable";

import { ReviewsSection } from "../rating-summary";
import { TapResult } from "../tap-result";

/**
 * TAP-T08: the page a shopper sees after a tap, in each of the 12 approved
 * states. Every state is built the way the server builds it (tapPageModel →
 * <TapResult>) from data that contains an owner address, a seller address, a
 * reviewer address and a failure reason — and then checked for what it says
 * and for what it must not show.
 */

/** How each state comes about. "linkUsed" has no trigger yet (TAP-T10). */
const CASES: Record<TapStateKey, { res: TapResolution; lookup: AssetLookup | null } | null> = {
  newForSale: { res: resolvedTap(STATE.ACTIVATED), lookup: record(STATE.ACTIVATED, true) },
  newNotForSale: { res: resolvedTap(STATE.ACTIVATED), lookup: record(STATE.ACTIVATED) },
  owned: { res: resolvedTap(STATE.CLAIMED), lookup: record(STATE.CLAIMED) },
  notReleased: { res: resolvedTap(STATE.BOUND), lookup: record(STATE.BOUND) },
  reported: { res: resolvedTap(STATE.FLAGGED), lookup: record(STATE.FLAGGED) },
  retired: { res: resolvedTap(STATE.RECYCLED), lookup: record(STATE.RECYCLED) },
  checkFailed: { res: FAILED_TAP, lookup: null },
  linkUsed: null,
  noProduct: { res: UNLINKED_TAP, lookup: null },
  ourSide: { res: BROKEN_LOOKUP_TAP, lookup: null },
  linkIncomplete: { res: { kind: "bad-params" }, lookup: null },
  privateItem: { res: resolvedTap(STATE.CLAIMED), lookup: RESTRICTED },
};

const STATES = Object.keys(CASES) as TapStateKey[];

/**
 * Render a state the way the page does, with stand-ins for the interactive
 * parts. `withFrame: false` leaves out the frame that resolves over the page,
 * which repeats the headline on purpose.
 */
function page(state: TapStateKey, withFrame = true): string {
  const built = CASES[state];
  if (!built) return renderToStaticMarkup(<TapResult state={state} />);
  return render(built, state, withFrame);
}

/** A finished tap, rendered the way <TapVerdict> renders it. */
function render(
  built: { res: TapResolution; lookup: AssetLookup | null },
  expected: TapStateKey,
  withFrame = true,
): string {
  const model = tapPageModel({ ...built, stepsSeen: 1, tookMs: 250 });
  expect(model.state).toBe(expected); // the data really leads to this state
  const { product } = model;
  return renderToStaticMarkup(
    <TapResult
      state={model.state}
      product={product}
      recordNumber={model.recordNumber}
      technical={model.technical}
      detailsCheck={model.detailsCheck}
      missingDetails={model.missingDetails}
      retryHref="/sun?picc=AA&cmac=BB"
      progress={withFrame ? model.progress : undefined}
      timing="sdm;dur=0.2, total;dur=250.0"
      slots={
        product
          ? {
              photo: product.photo ? (
                <img src={product.photo.url} alt={COPY.product.photoAlt(product.name)} />
              ) : undefined,
              buy: model.show.buy ? (
                <button type="button">{COPY.buy.button(product.price ?? "")}</button>
              ) : undefined,
              reviews: model.show.reviews ? (
                <ReviewsSection
                  view={RATINGS}
                  write={<button type="button">{COPY.reviews.write}</button>}
                />
              ) : undefined,
              history: model.show.history ? <p>(product history loads here)</p> : undefined,
            }
          : undefined
      }
    />,
  );
}

/** The page itself, without the frame that resolves over it. */
const body = (state: TapStateKey) => page(state, false);

describe("what a shopper reads, state by state", () => {
  it.each(STATES)("%s", (state) => {
    const text = readable(body(state));
    // The approved words are on the page…
    expect(text).toContain(`# ${TAP_STATES[state].headline}`);
    expect(text).toContain(`${TAP_STATES[state].line}.`);
    // …and the whole reading is pinned.
    expect(text).toMatchSnapshot();
  });
});

describe("every state", () => {
  it.each(STATES)(
    "%s has one verdict, announced as a status, and the honest-status sentence",
    (state) => {
      const html = body(state);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toMatch(/<div role="status"[^>]*>[\s\S]*?<h1/);
      expect(html).toContain(COPY.honestStatus);
    },
  );

  it.each(STATES)("%s keeps the drawer closed", (state) => {
    expect(page(state)).not.toMatch(/<details[^>]*\bopen\b/);
  });
});

describe("what must never be on a shopper page", () => {
  it.each(STATES)("%s shows no owner, seller or reviewer address anywhere", (state) => {
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

  it.each(STATES)("%s never says why a check failed or names a setting", (state) => {
    const html = page(state);
    for (const leak of [
      FAIL_REASON,
      LOOKUP_ERROR,
      "SDM_MASTER_KEY",
      "env var",
      "decrypt",
      "mismatch",
    ]) {
      expect(html).not.toContain(leak);
    }
  });

  it.each(STATES)(
    "%s shows no address, tag ID or state code outside Technical details",
    (state) => {
      const visible = outsideDrawer(page(state));
      // any 0x… value: an address, a hash, a fingerprint
      expect(visible).not.toMatch(/0x[0-9a-fA-F]{4,}/);
      // the tag's ID, written either way
      expect(visible).not.toContain(TAG_UID);
      expect(visible).not.toContain(TAG_ID_SHOWN);
      // state names and codes
      expect(visible).not.toMatch(/\b(NONE|MINTED|BOUND|ACTIVATED|CLAIMED|FLAGGED|RECYCLED)\b/);
      expect(readable(visible)).not.toMatch(/\(\d\)/);
    },
  );

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
});

describe("Technical details", () => {
  it("holds the record number, the tag ID, the state code, the network and the public record", () => {
    const drawer = insideDrawer(page("owned"));
    expect(drawer).toContain(COPY.technical.title);
    for (const value of [
      RECORD_NUMBER,
      TAG_ID_SHOWN,
      "CLAIMED (4)",
      COPY.technical.networkValue,
      "42",
    ]) {
      expect(drawer).toContain(value);
    }
    expect(drawer).toContain(`${FINGERPRINT.slice(0, 18)}…`);
    expect(drawer).toContain(COPY.technical.viewPublicRecord);
    expect(drawer).toContain(`href="/asset/${RECORD_NUMBER}"`);
  });

  it("is a plain <details>: it opens without any script", () => {
    expect(page("owned")).toMatch(/<details[^>]*><summary/);
  });

  it("has nothing at all for a failed check or a broken link", () => {
    expect(page("checkFailed")).not.toContain("<details");
    expect(page("linkIncomplete")).not.toContain("<details");
  });

  it("holds the tag's ID for a genuine tag with no product, and no record number", () => {
    const drawer = insideDrawer(page("noProduct"));
    expect(drawer).toContain(TAG_ID_SHOWN);
    expect(drawer).not.toContain(COPY.technical.recordNumber);
  });
});

describe("the parts each state does and does not get", () => {
  const has = (state: TapStateKey, text: string) => readable(body(state)).includes(text);

  it("offers to buy only an item that is new and for sale, with the server's price", () => {
    expect(has("newForSale", COPY.buy.button("$23.33"))).toBe(true);
    expect(body("newForSale")).toContain("≈ €21.11");
    for (const state of STATES.filter((s) => s !== "newForSale")) {
      expect(has(state, COPY.buy.buttonNoPrice)).toBe(false);
      expect(body(state)).not.toContain("$23.33");
    }
  });

  it("shows no buy button and no price in a state that cannot be bought, whatever it is handed", () => {
    // An owned item its owner listed again: the record carries a price, and a
    // caller might hand the page a buy button. Neither is shown.
    const model = tapPageModel({
      res: resolvedTap(STATE.CLAIMED),
      lookup: record(STATE.CLAIMED, true),
      stepsSeen: 1,
      tookMs: 250,
    });
    expect(model.state).toBe("owned");
    expect(model.product?.price).toBe("$23.33");
    for (const state of STATES.filter((s) => s !== "newForSale")) {
      const html = renderToStaticMarkup(
        <TapResult
          state={state}
          product={model.product}
          slots={{ buy: <button type="button">BUY-SLOT</button> }}
        />,
      );
      expect(html).not.toContain("BUY-SLOT");
      expect(html).not.toContain("$23.33");
    }
  });

  it("shows product details only when the tap led to an item that is not private", () => {
    for (const state of [
      "newForSale",
      "newNotForSale",
      "owned",
      "notReleased",
      "reported",
      "retired",
    ] as const) {
      expect(has(state, "Renewal Cream")).toBe(true);
    }
    for (const state of [
      "privateItem",
      "checkFailed",
      "linkUsed",
      "noProduct",
      "ourSide",
      "linkIncomplete",
    ] as const) {
      expect(has(state, "Renewal Cream")).toBe(false);
      expect(has(state, "TAG IT Demo")).toBe(false);
    }
  });

  it("explains how we know only when the product checked out", () => {
    for (const state of STATES) {
      const authentic = TAP_STATES[state].headline === "Authentic";
      expect(has(state, `## ${COPY.trust.title}`)).toBe(authentic);
    }
  });

  it("gives the second-hand tip on an owned item, in the approved words", () => {
    expect(has("owned", COPY.status.secondHandBody)).toBe(true);
    expect(has("newForSale", COPY.status.secondHandBody)).toBe(false);
  });

  it("offers Try again, to the same tap, only when our side failed", () => {
    expect(body("ourSide")).toContain('href="/sun?picc=AA&amp;cmac=BB"');
    expect(has("ourSide", COPY.actions.tryAgain)).toBe(true);
    expect(has("checkFailed", COPY.actions.tryAgain)).toBe(false);
  });

  it("names a reviewer only as a verified owner", () => {
    expect(has("owned", COPY.reviews.verifiedOwner)).toBe(true);
    expect(has("owned", "Soaks in fast and lasts all day.")).toBe(true);
  });

  it("warns when the product details do not match the brand's record", () => {
    const lookup = record(STATE.ACTIVATED, true);
    if (lookup.kind !== "record") throw new Error("fixture");
    lookup.dto.verification = { ...lookup.dto.verification!, verified: false };
    const model = tapPageModel({
      res: resolvedTap(STATE.ACTIVATED),
      lookup,
      stepsSeen: 1,
      tookMs: 250,
    });
    const html = renderToStaticMarkup(
      <TapResult state={model.state} product={model.product} detailsCheck={model.detailsCheck} />,
    );
    expect(html).toContain("We couldn&#x27;t confirm these product details");
    expect(body("newForSale")).not.toContain("We couldn&#x27;t confirm these product details");
  });
});

describe("when the tap led to an item whose details are not on the page", () => {
  const SCENARIOS: Record<
    string,
    { res: TapResolution; lookup: AssetLookup | null; state: TapStateKey; note: string }
  > = {
    "new, record did not load": {
      res: resolvedTap(STATE.ACTIVATED),
      lookup: { kind: "unavailable" },
      state: "newNotForSale",
      note: COPY.status.detailsUnavailable,
    },
    "owned, no record on file": {
      res: resolvedTap(STATE.CLAIMED),
      lookup: { kind: "none" },
      state: "owned",
      note: COPY.status.detailsUnavailable,
    },
    "reported and private": {
      res: resolvedTap(STATE.FLAGGED),
      lookup: RESTRICTED,
      state: "reported",
      note: COPY.status.detailsPrivate,
    },
    "retired and private": {
      res: resolvedTap(STATE.RECYCLED),
      lookup: RESTRICTED,
      state: "retired",
      note: COPY.status.detailsPrivate,
    },
  };
  const NAMES = Object.keys(SCENARIOS);
  const html = (name: string) => {
    const { state, ...built } = SCENARIOS[name]!;
    return render(built, state, false);
  };

  it.each(NAMES)("%s: keeps the verdict and says why there is no product under it", (name) => {
    const { state, note } = SCENARIOS[name]!;
    const text = readable(html(name));
    expect(text).toContain(`# ${TAP_STATES[state].headline}`);
    expect(text).toContain(note);
    // no card that only says "This product", and none of the item's details
    expect(text).not.toContain(COPY.product.fallbackName);
    expect(text).not.toContain("Renewal Cream");
    expect(text).not.toContain("TAG IT Protected Asset");
    expect(text).toMatchSnapshot();
  });

  it.each(NAMES)("%s: links only to sections that are on the page", (name) => {
    const page = html(name);
    for (const [, id] of page.matchAll(/href="#([^"]+)"/g)) {
      expect(page, `links to #${id}`).toContain(`id="${id}"`);
    }
  });

  it.each(NAMES)("%s: shows nothing it must not", (name) => {
    const page = html(name);
    for (const secret of [OWNER, OWNER_SHORT, OWNER.slice(0, 8), SELLER, REVIEWER]) {
      expect(page).not.toContain(secret);
    }
    const visible = outsideDrawer(page);
    expect(visible).not.toMatch(/0x[0-9a-fA-F]{4,}/);
    expect(visible).not.toContain(TAG_ID_SHOWN);
    expect(visible).not.toMatch(/\b(NONE|MINTED|BOUND|ACTIVATED|CLAIMED|FLAGGED|RECYCLED)\b/);
    expect(page.match(/<h1\b/g)).toHaveLength(1);
    expect(page).toContain(COPY.honestStatus);
  });

  it("does not say details are missing when they are there, or say it twice", () => {
    for (const state of STATES) {
      const text = readable(body(state));
      expect(text).not.toContain(COPY.status.detailsUnavailable);
      // the private-item verdict says it once, as its own line; no state repeats it
      expect(text.split(COPY.status.detailsPrivate)).toHaveLength(state === "privateItem" ? 2 : 1);
    }
  });
});

describe("the page frame", () => {
  it("carries the tap's step durations, for the timing checks", () => {
    expect(page("owned")).toMatch(/<main[^>]*data-tap-timing="sdm;dur=0.2, total;dur=250.0"/);
    expect(renderToStaticMarkup(<TapResult state="linkIncomplete" />)).not.toContain(
      "data-tap-timing",
    );
  });

  it("links the page's own sections only where they exist", () => {
    for (const state of STATES) {
      const html = body(state);
      for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) {
        expect(html, `${state} links to #${id}`).toContain(`id="${id}"`);
      }
    }
  });
});

describe("with scripts turned off", () => {
  /** Opening tags of the elements that are left out while scripts are off. */
  const leftOut = (html: string) => html.match(/<[a-z0-9]+\b[^>]*\bdata-needs-script[^>]*>/g) ?? [];

  it.each(STATES)("%s carries the rule that leaves script-only parts out", (state) => {
    expect(page(state)).toContain(
      "<noscript><style>[data-needs-script]{display:none!important}</style></noscript>",
    );
  });

  it.each(STATES)("%s keeps the verdict, the product and Technical details", (state) => {
    for (const tag of leftOut(page(state))) {
      // only whole sections are left out — never the page, the verdict or the drawer
      expect(tag.startsWith("<section")).toBe(true);
      expect(tag).not.toMatch(/role="status"|data-verdict|data-technical|aria-label/);
    }
  });

  it("leaves out the history, which the browser has to load", () => {
    const tags = leftOut(body("owned"));
    expect(tags).toHaveLength(1);
    expect(body("owned")).toMatch(
      new RegExp(`<section[^>]*data-needs-script[^>]*><h2[^>]*>${COPY.history.title}</h2>`),
    );
  });

  it("leaves out reviews that arrive after the page, and keeps reviews that are part of it", () => {
    const late = renderToStaticMarkup(<ReviewsSection view={RATINGS} late />);
    expect(leftOut(late)).toHaveLength(1);
    expect(late).toMatch(/^<section[^>]*data-needs-script/);
    expect(leftOut(renderToStaticMarkup(<ReviewsSection view={RATINGS} />))).toHaveLength(0);
  });
});

describe("the frame that resolves into the verdict", () => {
  it("carries the same headline and tone as the page under it", () => {
    for (const state of STATES.filter((s) => CASES[s])) {
      const frame = /<div[^>]*data-tap-frame="resolved"[^>]*>/.exec(page(state))?.[0] ?? "";
      expect(frame).toContain(`data-tone="${TAP_STATES[state].tone}"`);
    }
    expect(page("owned")).toMatch(/data-tap-frame="resolved"[\s\S]*?Authentic/);
  });

  it("is left out when no check ran", () => {
    expect(renderToStaticMarkup(<TapResult state="linkIncomplete" />)).not.toContain(
      "data-tap-frame",
    );
  });
});
