import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { COPY, TAP_STATES, type TapStateKey } from "@/lib/consumer-copy";
import type { AssetLookup } from "@/lib/services";
import type { TapResolution } from "@/lib/resolve";
import { tapPageModel } from "@/lib/tap-page";
import {
  AGAIN,
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
  UNCHECKED_LINK_TAP,
  UNLINKED_TAP,
  USED_LINK_TAP,
  record,
  resolvedTap,
} from "@/test-support/shopper-fixtures";
import {
  insideDrawer,
  onShow,
  outsideDrawer,
  readable,
  rowNames,
  rowOf,
} from "@/test-support/readable";

import {
  RatingLine,
  ReviewsContent,
  ReviewsLoading,
  ReviewsRow,
  ReviewsSection,
} from "../rating-summary";
import { TapResult } from "../tap-result";

/**
 * TAP-T08: the page a shopper sees after a tap, in each of the 12 approved
 * states. Every state is built the way the server builds it (tapPageModel →
 * <TapResult>) from data that contains an owner address, a seller address, a
 * reviewer address and a failure reason — and then checked for what it says
 * and for what it must not show.
 */

/** How each state comes about. */
const CASES: Record<TapStateKey, { res: TapResolution; lookup: AssetLookup | null } | null> = {
  newForSale: { res: resolvedTap(STATE.ACTIVATED), lookup: record(STATE.ACTIVATED, true) },
  newNotForSale: { res: resolvedTap(STATE.ACTIVATED), lookup: record(STATE.ACTIVATED) },
  owned: { res: resolvedTap(STATE.CLAIMED), lookup: record(STATE.CLAIMED) },
  notReleased: { res: resolvedTap(STATE.BOUND), lookup: record(STATE.BOUND) },
  reported: { res: resolvedTap(STATE.FLAGGED), lookup: record(STATE.FLAGGED) },
  retired: { res: resolvedTap(STATE.RECYCLED), lookup: record(STATE.RECYCLED) },
  checkFailed: { res: FAILED_TAP, lookup: null },
  linkUsed: { res: USED_LINK_TAP, lookup: null },
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
      repeat={model.repeat}
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
                <button type="button">
                  {product.price ? COPY.buy.button(product.price) : COPY.buy.buttonNoPrice}
                </button>
              ) : undefined,
              // As <TapVerdict> builds them: the rating line and the contents of
              // the reviews row are sent after the page; the row itself is not.
              rating: model.show.reviews ? <RatingLine view={RATINGS} late /> : undefined,
              reviews: model.show.reviews ? (
                <ReviewsRow needsScript>
                  <ReviewsContent
                    view={RATINGS}
                    write={<button type="button">{COPY.reviews.write}</button>}
                    late
                  />
                </ReviewsRow>
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
    for (const internal of [
      FAIL_REASON,
      LOOKUP_ERROR,
      "SDM_MASTER_KEY",
      "env var",
      "decrypt",
      "mismatch",
    ]) {
      expect(html).not.toContain(internal);
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
    expect(page("owned")).toMatch(/<details[^>]*\bdata-technical\b[^>]*><summary/);
  });

  it("is the last row of the page", () => {
    for (const state of STATES) {
      const names = rowNames(body(state));
      if (names.includes("technical")) expect(names.at(-1), state).toBe("technical");
    }
  });

  it("has nothing at all for a failed check or a broken link", () => {
    expect(page("checkFailed")).not.toContain("data-technical");
    expect(page("linkIncomplete")).not.toContain("data-technical");
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
      expect(rowNames(body(state)).includes("how-we-know")).toBe(authentic);
    }
  });

  it("explains how a check works, in general terms, only where nothing was confirmed", () => {
    for (const state of STATES) {
      const general = state === "checkFailed" || state === "linkUsed";
      expect(rowNames(body(state)).includes("how-it-works"), state).toBe(general);
      // …and that explanation never says this item passed
      if (general) expect(readable(rowOf(body(state), "how-it-works"))).not.toMatch(/\bthis\b/i);
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

describe("a used link (TAP-T10)", () => {
  it("says the check has expired and how to get a fresh one, and nothing about any product", () => {
    const text = readable(body("linkUsed"));
    expect(text).toContain(`# ${TAP_STATES.linkUsed.headline}`);
    expect(text).toContain(COPY.linkUsed.againTitle);
    expect(text).toContain(COPY.linkUsed.againBody);
    for (const line of COPY.linkUsed.why) expect(text).toContain(line);
    expect(text).not.toMatch(/authentic/i);
    expect(text).not.toContain("Renewal Cream");
    expect(text).not.toContain(COPY.buy.buttonNoPrice);
  });

  it("is drawn in the warning tone, never the reassuring one", () => {
    const html = body("linkUsed");
    expect(html).toContain('data-verdict="warn"');
    expect(html).not.toContain('data-verdict="ok"');
  });

  it("stays a used link even if it is handed a product, a buy button and reviews", () => {
    const model = tapPageModel({
      res: resolvedTap(STATE.ACTIVATED),
      lookup: record(STATE.ACTIVATED, true),
      stepsSeen: 1,
      tookMs: 250,
    });
    const html = renderToStaticMarkup(
      <TapResult
        state="linkUsed"
        product={model.product}
        recordNumber={model.recordNumber}
        slots={{
          buy: <button type="button">BUY-SLOT</button>,
          photo: <img src="/photo.webp" alt="PHOTO-SLOT" />,
          rating: <p>RATING-SLOT</p>,
        }}
      />,
    );
    for (const leaked of ["BUY-SLOT", "PHOTO-SLOT", "RATING-SLOT", "Renewal Cream", "$23.33"]) {
      expect(html).not.toContain(leaked);
    }
  });

  it("a link that could not be checked reads exactly like any other failure on our side", () => {
    const unchecked = render({ res: UNCHECKED_LINK_TAP, lookup: null }, "ourSide", false);
    expect(unchecked).toBe(body("ourSide"));
    expect(readable(unchecked)).not.toMatch(/authentic/i);
    expect(readable(unchecked)).toContain(COPY.actions.tryAgain);
  });
});

describe("the same phone opening its check again (TAP-T10)", () => {
  /** The states a tap that led to an item can end in. */
  const RESULT_STATES = STATES.filter((state) => CASES[state]?.res.kind === "resolved");
  const again = (
    state: TapStateKey,
    secondsAgo = AGAIN.kind === "again" ? AGAIN.secondsAgo : 0,
  ) => {
    const built = CASES[state]!;
    if (built.res.kind !== "resolved") throw new Error("not a result state");
    return render(
      { res: { ...built.res, link: { kind: "again", secondsAgo } }, lookup: built.lookup },
      state,
      false,
    );
  };

  it("covers every state a tap can lead to an item in", () => {
    expect(RESULT_STATES.sort()).toEqual(
      [
        "newForSale",
        "newNotForSale",
        "notReleased",
        "owned",
        "privateItem",
        "reported",
        "retired",
      ].sort(),
    );
  });

  it.each(RESULT_STATES)(
    "%s: says it is an earlier check, before anything about the product",
    (state) => {
      const text = readable(again(state));
      const note = COPY.repeat.note(3);

      expect(text).toContain(note);
      // the verdict first, then the note, then the rest of the page
      expect(text.indexOf(`# ${TAP_STATES[state].headline}`)).toBeLessThan(text.indexOf(note));
      if (text.includes("Renewal Cream")) {
        expect(text.indexOf(note)).toBeLessThan(text.indexOf("Renewal Cream"));
      }
    },
  );

  it.each(RESULT_STATES)("%s: nothing on the page reads as checked just now", (state) => {
    expect(readable(again(state))).not.toMatch(/just now/i);
    // …while the first look of the two "new" states does say it
    if (/just now/i.test(TAP_STATES[state].line)) {
      expect(readable(body(state))).toMatch(/just now/i);
    }
  });

  it("replaces only the line that says 'just now', and keeps every other state's line", () => {
    for (const state of RESULT_STATES) {
      const text = readable(again(state));
      if (/just now/i.test(TAP_STATES[state].line)) {
        expect(text, state).toContain(`${COPY.repeat.line}.`);
        expect(text, state).not.toContain(TAP_STATES[state].line);
      } else {
        expect(text, state).toContain(`${TAP_STATES[state].line}.`);
        expect(text, state).not.toContain(COPY.repeat.line);
      }
    }
  });

  it.each(RESULT_STATES)("%s: is otherwise the very page of the first look", (state) => {
    const first = readable(body(state));
    const second = readable(again(state))
      .replace(`${COPY.repeat.note(3)}\n`, "")
      .replace(COPY.repeat.note(3), "")
      .replace(`${COPY.repeat.line}.`, `${TAP_STATES[state].line}.`);
    const squeeze = (text: string) => text.replace(/\s+/g, " ").trim();
    expect(squeeze(second)).toBe(squeeze(first));
  });

  it.each(RESULT_STATES)("%s: keeps its verdict, its tone and its rows", (state) => {
    const first = body(state);
    const second = again(state);
    expect(second).toContain(`data-verdict="${TAP_STATES[state].tone}"`);
    expect(second.match(/<h1\b/g)).toHaveLength(1);
    expect(rowNames(second)).toEqual(rowNames(first));
    expect(second).toContain(COPY.honestStatus);
  });

  it("says how long ago in whole minutes", () => {
    expect(readable(again("owned", 5))).toContain("You checked this a moment ago.");
    expect(readable(again("owned", 60))).toContain("You checked this 1 minute ago.");
    expect(readable(again("owned", 7 * 60 + 59))).toContain("You checked this 7 minutes ago.");
    expect(readable(again("owned", 600))).toContain("You checked this 10 minutes ago.");
  });

  it("a first look never carries the note", () => {
    for (const state of STATES) {
      expect(readable(body(state)), state).not.toContain("You checked this");
    }
  });

  it("shows no owner, seller or reviewer address, and nothing technical outside the drawer", () => {
    for (const state of RESULT_STATES) {
      const html = again(state);
      for (const secret of [OWNER, OWNER_SHORT, OWNER.slice(0, 8), SELLER, REVIEWER]) {
        expect(html, state).not.toContain(secret);
      }
      const visible = outsideDrawer(html);
      expect(visible, state).not.toMatch(/0x[0-9a-fA-F]{4,}/);
      expect(visible, state).not.toContain(TAG_ID_SHOWN);
    }
  });

  it("owned, opened again: the whole reading", () => {
    expect(readable(again("owned"))).toMatchSnapshot();
  });

  it("new and for sale, opened again: the whole reading", () => {
    expect(readable(again("newForSale"))).toMatchSnapshot();
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

  it("still lets a new item be bought when its record did not load: the listing is not known", () => {
    const slots = { buy: <button type="button">BUY-SLOT</button> };
    const shown = (state: TapStateKey, missingDetails?: "private" | "unavailable") =>
      renderToStaticMarkup(
        <TapResult state={state} missingDetails={missingDetails} slots={slots} />,
      ).includes("BUY-SLOT");

    expect(shown("newNotForSale", "unavailable")).toBe(true);
    // the record loaded and says "not listed": that is an answer
    expect(shown("newNotForSale")).toBe(false);
    // an owner, a report or a retirement rules a purchase out, record or no record
    for (const state of ["owned", "reported", "retired", "notReleased", "privateItem"] as const) {
      expect(shown(state, "unavailable")).toBe(false);
      expect(shown(state, "private")).toBe(false);
    }
    // through the model: the page offers the widget, and still says details are missing
    const text = readable(html("new, record did not load"));
    expect(text).toContain(`[button: ${COPY.buy.buttonNoPrice}]`);
    expect(text).toContain(COPY.status.detailsUnavailable);
    expect(readable(html("owned, no record on file"))).not.toContain(COPY.buy.buttonNoPrice);
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

  it("has no link to a place further down the same page", () => {
    // A row that is closed cannot be jumped to: the reader would land on a
    // closed row. Everything further down is reached by opening its row.
    for (const state of STATES) expect(body(state), state).not.toMatch(/href="#/);
  });

  it("is coloured to match its verdict", () => {
    for (const state of STATES) {
      const tone = TAP_STATES[state].tone;
      // the page's outermost element, and the verdict inside it
      expect(body(state).includes(`min-h-screen`), state).toBe(true);
      expect(
        /<div class="[^"]*min-h-screen[^"]*" data-tone="(\w+)"/.exec(body(state))?.[1],
        state,
      ).toBe(tone);
      expect(body(state).includes(`<div role="status" data-verdict="${tone}"`), state).toBe(true);
    }
  });
});

describe("the order a shopper reads in", () => {
  /** Where each of these first appears in the page as it is read out. */
  const order = (state: TapStateKey, marks: string[]) => {
    const text = readable(body(state));
    return marks.map((mark) => {
      const at = text.indexOf(mark);
      expect(at, `${state}: "${mark}" is on the page`).toBeGreaterThan(-1);
      return at;
    });
  };
  const rising = (positions: number[]) =>
    positions.every((at, i) => i === 0 || at > positions[i - 1]!);

  it("for sale: verdict, name, rating, price, the buy button, then the rows", () => {
    expect(
      rising(
        order("newForSale", [
          "# Authentic",
          "## Renewal Cream",
          "2 verified owner reviews",
          "$23.33",
          `[button: ${COPY.buy.button("$23.33")}]`,
          COPY.status.newTitle,
          `## ${COPY.reviews.title}`,
          `## ${COPY.about.title}`,
          `## ${COPY.history.title}`,
          `## ${COPY.trust.title}`,
          `## ${COPY.technical.title}`,
          COPY.help.title,
          COPY.honestStatus,
        ]),
      ),
    ).toBe(true);
  });

  it("owned: verdict, name, rating, the second-hand tip, then the rows", () => {
    expect(
      rising(
        order("owned", [
          "# Authentic",
          "## Renewal Cream",
          "2 verified owner reviews",
          COPY.status.secondHandTitle,
          `## ${COPY.reviews.title}`,
          `## ${COPY.about.title}`,
          `## ${COPY.technical.title}`,
        ]),
      ),
    ).toBe(true);
  });

  it("reported: the warning, the product, what it means and what to do, then the rows", () => {
    expect(
      rising(
        order("reported", [
          `# ${TAP_STATES.reported.headline}`,
          "## Renewal Cream",
          COPY.status.tagIsRealNote,
          `## ${COPY.reported.meaningTitle}`,
          `## ${COPY.reported.doTitle}`,
          COPY.actions.reportSighting,
          `## ${COPY.about.title}`,
          `## ${COPY.technical.title}`,
        ]),
      ),
    ).toBe(true);
  });

  it("puts the reviews row first among the rows, wherever there are reviews", () => {
    for (const state of ["newForSale", "newNotForSale", "owned"] as const) {
      expect(rowNames(body(state))[0], state).toBe("reviews");
    }
  });

  it("gives each state exactly these rows", () => {
    const product = ["reviews", "about", "history", "how-we-know", "technical"];
    expect(Object.fromEntries(STATES.map((state) => [state, rowNames(body(state))]))).toEqual({
      newForSale: product,
      newNotForSale: product,
      owned: product,
      notReleased: ["about", "history", "technical"],
      reported: ["about", "history", "technical"],
      retired: ["about", "history", "technical"],
      checkFailed: ["how-it-works"],
      // A used link comes from a real tag, so it has that tag's technical rows.
      linkUsed: ["how-it-works", "technical"],
      noProduct: ["technical"],
      ourSide: ["technical"],
      linkIncomplete: [],
      privateItem: ["how-we-know", "technical"],
    });
  });
});

describe("rows that open", () => {
  const rows = (state: TapStateKey) =>
    rowNames(body(state)).map((name) => rowOf(body(state), name));

  it.each(STATES)("%s: every row is a closed <details> with its name as a heading", (state) => {
    for (const row of rows(state)) {
      expect(row).not.toMatch(/^<details[^>]*\bopen\b/);
      // The summary holds one heading and nothing else, which is what a
      // <summary> may hold; the heading names the row.
      expect(row).toMatch(/^<details[^>]*><summary[^>]*><h2[^>]*>[\s\S]*?<\/h2><\/summary>/);
      expect(readable(row).split("\n")[1]).toMatch(/^## \S/);
    }
  });

  it.each(STATES)("%s: a row's text is in the page whether or not it is open", (state) => {
    for (const row of rows(state)) {
      // Nothing but the browser's own closed state keeps it out of sight.
      expect(row).not.toMatch(
        /\shidden[\s=>]|display:\s*none|aria-hidden="true"[^>]*class="[^"]*panel/,
      );
      expect(readable(row).split("\n").length).toBeGreaterThan(3);
    }
  });

  it("holds the product's details, the history and the explanation, not the verdict", () => {
    const shown = readable(onShow(body("owned")));
    expect(shown).toContain("# Authentic");
    expect(shown).toContain("Renewal Cream");
    expect(shown).not.toContain("Product code");
    expect(shown).not.toContain(COPY.trust.points[0].title);
    expect(readable(rowOf(body("owned"), "about"))).toContain("Product code: TD-RC-50");
    expect(readable(rowOf(body("owned"), "how-we-know"))).toContain(COPY.trust.points[0].title);
  });
});

describe("what stays on show without opening anything", () => {
  const shown = (state: TapStateKey) => readable(onShow(body(state)));

  it.each(STATES)("%s: the verdict, its line and the honest-status sentence", (state) => {
    const text = shown(state);
    expect(text).toContain(`# ${TAP_STATES[state].headline}`);
    expect(text).toContain(`${TAP_STATES[state].line}.`);
    expect(text).toContain(COPY.honestStatus);
  });

  it("a warning and what to do about it are never inside a row", () => {
    const reported = shown("reported");
    for (const line of [
      COPY.status.tagIsRealNote,
      ...COPY.reported.meaning,
      ...COPY.reported.steps,
      COPY.actions.reportSighting,
    ]) {
      expect(reported).toContain(line);
    }
    const failed = shown("checkFailed");
    for (const step of COPY.checkFailed.steps) {
      expect(failed).toContain(step.title);
      expect(failed).toContain(step.body);
    }
    expect(failed).toContain(COPY.checkFailed.why);
    expect(shown("linkUsed")).toContain(COPY.linkUsed.againTitle);
    expect(shown("ourSide")).toContain(COPY.actions.tryAgain);
    expect(shown("notReleased")).toContain(COPY.status.notReleasedTip);
  });

  it("the notes about missing or unconfirmed details are never inside a row", () => {
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
      <TapResult
        state={model.state}
        product={model.product}
        technical={model.technical}
        detailsCheck={model.detailsCheck}
      />,
    );
    expect(readable(onShow(html))).toContain(COPY.status.detailsNotConfirmed);
  });

  it("the name, the price and the buy button of an item for sale", () => {
    const text = shown("newForSale");
    for (const mark of [
      "## Renewal Cream",
      "$23.33",
      COPY.buy.button("$23.33"),
      "2 verified owner reviews",
    ]) {
      expect(text).toContain(mark);
    }
  });
});

describe("the rating under the product's name", () => {
  const line = (html: string) => /<p[^>]*\bdata-rating\b[^>]*>[\s\S]*?<\/p>/.exec(html)?.[0] ?? "";

  it("says the average and how many owners reviewed it, where reviews are shown", () => {
    for (const state of ["newForSale", "newNotForSale", "owned"] as const) {
      const text = readable(line(body(state)));
      expect(text, state).toContain("(4.5 out of 5 stars)");
      expect(text, state).toContain("2 verified owner reviews");
    }
  });

  it("sits in the product block, after the name and before the price", () => {
    const html = body("newForSale");
    const product = /<section aria-label="Product"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect(product).toContain("data-rating");
    expect(product.indexOf("<h2")).toBeLessThan(product.indexOf("data-rating"));
    expect(product.indexOf("data-rating")).toBeLessThan(product.indexOf("data-price"));
  });

  it("is absent where reviews are not shown, and when there are none yet", () => {
    for (const state of STATES.filter(
      (s) => !["newForSale", "newNotForSale", "owned"].includes(s),
    )) {
      expect(body(state), state).not.toContain("data-rating");
    }
    const none = { ...RATINGS, product: null, reviews: [] };
    expect(renderToStaticMarkup(<RatingLine view={none} />)).toBe("");
    expect(renderToStaticMarkup(<RatingLine view={null} />)).toBe("");
    expect(renderToStaticMarkup(<RatingLine view={{ ...RATINGS, restricted: true }} />)).toBe("");
  });

  it("names nobody", () => {
    const html = line(body("owned"));
    expect(html).not.toContain(REVIEWER);
    expect(html).not.toMatch(/0x/);
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
    const html = page(state);
    const reviews = rowOf(html, "reviews");
    for (const tag of leftOut(html)) {
      // Only a row that cannot work without scripts, or a part that is sent
      // late — never the page, the verdict or Technical details.
      const aLateRow = /^<details\b[^>]*data-row="(history|reviews)"/.test(tag);
      const theRatingLine = /^<p\b[^>]*data-rating/.test(tag);
      const insideTheReviewsRow = tag.startsWith("<div") && reviews.includes(tag);
      expect(aLateRow || theRatingLine || insideTheReviewsRow, tag.slice(0, 80)).toBe(true);
      expect(tag).not.toMatch(/role="status"|data-verdict|data-technical|aria-label/);
    }
  });

  it("leaves out the history, which the browser has to load, and the reviews, which are sent late", () => {
    const html = body("owned");
    const rows = leftOut(html)
      .map((tag) => /data-row="([^"]+)"/.exec(tag)?.[1])
      .filter(Boolean);
    expect(rows.sort()).toEqual(["history", "reviews"]);
    expect(readable(rowOf(html, "history"))).toContain(`## ${COPY.history.title}`);
    // a state without reviews leaves out the history only
    expect(leftOut(body("reported")).map((tag) => /data-row="([^"]+)"/.exec(tag)?.[1])).toEqual([
      "history",
    ]);
  });

  it("leaves out everything that is sent after the page, and keeps reviews that are part of it", () => {
    // Sent late, none of these can be moved into place without a script: it
    // would sit under the footer.
    const lateRow = renderToStaticMarkup(
      <ReviewsRow needsScript>
        <ReviewsContent view={RATINGS} late />
      </ReviewsRow>,
    );
    expect(lateRow).toMatch(/^<details[^>]*data-needs-script/);
    expect(leftOut(renderToStaticMarkup(<ReviewsContent view={RATINGS} late />))).toHaveLength(1);
    expect(leftOut(renderToStaticMarkup(<RatingLine view={RATINGS} late />))).toHaveLength(1);
    expect(leftOut(renderToStaticMarkup(<ReviewsLoading />))).toHaveLength(1);
    // the record page reads the reviews first: nothing of theirs is late
    expect(leftOut(renderToStaticMarkup(<ReviewsSection view={RATINGS} />))).toHaveLength(0);
    expect(leftOut(renderToStaticMarkup(<RatingLine view={RATINGS} />))).toHaveLength(0);
  });
});

describe("the reviews row on a tap page", () => {
  it("is part of the page from the first moment, whatever becomes of the reviews", () => {
    // The row does not wait for the reviews: it is there, closed, and only
    // what is inside it arrives later. So nothing under it moves when they do.
    const shell = renderToStaticMarkup(
      <ReviewsRow needsScript>
        <ReviewsLoading />
      </ReviewsRow>,
    );
    expect(readable(shell)).toContain(`## ${COPY.reviews.title}`);
    expect(shell).toMatch(/^<details[^>]*data-row="reviews"/);
    // while waiting: lines to look at, and words for a reader who cannot see them
    expect(readable(shell)).toContain(COPY.reviews.loadingList);
    expect(shell).toContain('aria-hidden="true"');
  });

  it("says so when the reviews could not be read, and does not call that 'no reviews'", () => {
    for (const view of [null, { ...RATINGS, restricted: true }]) {
      const text = readable(
        renderToStaticMarkup(
          <ReviewsContent view={view} write={<button type="button">WRITE</button>} late />,
        ),
      );
      expect(text).toContain(COPY.reviews.unavailable);
      expect(text).not.toContain(COPY.reviews.none);
      expect(text).not.toContain("WRITE");
      expect(text).not.toContain(COPY.reviews.verifiedOwner);
    }
  });

  it("says 'no reviews yet' only when the reviews were read and there are none", () => {
    const none = { ...RATINGS, product: null, reviews: [] };
    const text = readable(renderToStaticMarkup(<ReviewsContent view={none} late />));
    expect(text).toContain(COPY.reviews.none);
    expect(text).not.toContain(COPY.reviews.unavailable);
  });
});

describe("how the page arrives after a tap", () => {
  const main = (html: string) => /<main[^>]*>/.exec(html)?.[0] ?? "";
  /** The checking frame replayed over the page, up to the verdict that follows it. */
  const frame = (html: string) =>
    /<div[^>]*data-tap-frame="resolved"[\s\S]*?(?=<div role="status")/.exec(html)?.[0] ?? "";

  it("the frame draws no verdict: the page's one verdict arrives over it", () => {
    for (const state of STATES.filter((s) => CASES[s])) {
      const html = page(state);
      expect(frame(html), state).not.toBe("");
      expect(frame(html), state).not.toContain(TAP_STATES[state].headline);
      // one headline in the whole page, frame included
      expect(html.match(/<h1\b/g), state).toHaveLength(1);
    }
  });

  it("says the product page is opening only for a check that passed", () => {
    for (const state of STATES.filter((s) => CASES[s])) {
      expect(frame(page(state)).includes(COPY.checking.opening), state).toBe(
        TAP_STATES[state].tone === "ok",
      );
    }
  });

  it("the verdict settles into place after a check, and simply appears without one", () => {
    expect(main(page("owned"))).toContain('data-entrance="settle"');
    expect(main(body("owned"))).toContain('data-entrance="appear"');
    expect(main(renderToStaticMarkup(<TapResult state="linkIncomplete" />))).toContain(
      'data-entrance="appear"',
    );
  });

  it("wraps up briskly when the check already kept the shopper waiting", () => {
    const built = CASES.owned!;
    const after = (tookMs: number) => {
      const model = tapPageModel({ ...built, stepsSeen: 1, tookMs });
      return main(
        renderToStaticMarkup(<TapResult state={model.state} progress={model.progress} />),
      );
    };
    expect(after(250)).toContain('data-pace="full"');
    expect(after(2_000)).toContain('data-pace="brisk"');
    expect(main(body("owned"))).not.toContain("data-pace");
  });

  it("is left out when no check ran", () => {
    expect(renderToStaticMarkup(<TapResult state="linkIncomplete" />)).not.toContain(
      "data-tap-frame",
    );
  });
});
