/**
 * From a finished check to what the shopper sees (TAP-T08).
 *
 * Pure functions: no network, no rendering. The verdict itself is decided
 * elsewhere (lib/resolve.ts reads the tag and the chain); this module only
 * picks which of the approved states applies and gathers the few facts the
 * page shows. Nothing here can turn a failed check into a pass.
 *
 * Type-only imports from the server modules, so this file is safe to load in
 * tests and never pulls a server-only module into a browser bundle.
 */
import { COPY, type RecordStateKey, type TapStateKey } from "./consumer-copy";
import { formatFxApprox, type FxApproxRender } from "./fx";
import { isAllowedImageUrl } from "./media";
import { productFactsViewOf, type ProductFactsView } from "./product-facts";
import type { TapResolution } from "./resolve";
import type { AssetDto, AssetLookup, AssetMediaEntry } from "./services";

/** Lifecycle state numbers, as the chain reports them. */
const STATE = { MINTED: 1, BOUND: 2, ACTIVATED: 3, CLAIMED: 4, FLAGGED: 5, RECYCLED: 6 } as const;

/** What the item record adds to a resolved tap. */
export interface RecordFacts {
  /** The owner restricted this item's public details. */
  restricted: boolean;
  /** The server reports a live listing for it. */
  listed: boolean;
}

/**
 * Which of the 12 approved situations a finished tap is in.
 *
 * A warning about the item (reported, retired) always wins over privacy: a
 * private item that was reported still says so.
 */
export function tapStateFor(res: TapResolution, record: RecordFacts): TapStateKey {
  switch (res.kind) {
    case "bad-params":
      return "linkIncomplete";
    case "counterfeit":
      return "checkFailed";
    case "authentic-unbound":
      return "noProduct";
    case "not-configured":
    case "lookup-failed":
      return "ourSide";
    case "resolved":
      break;
  }
  const state = res.asset.state;
  if (state === STATE.FLAGGED) return "reported";
  if (state === STATE.RECYCLED) return "retired";
  if (state === STATE.MINTED || state === STATE.BOUND) return "notReleased";
  if (state !== STATE.ACTIVATED && state !== STATE.CLAIMED) return "noProduct";
  if (record.restricted) return "privateItem";
  if (state === STATE.CLAIMED) return "owned";
  return record.listed ? "newForSale" : "newNotForSale";
}

/** Which state the record page (/asset/…) is in. No tap happened there. */
export function recordStateFor(lookup: AssetLookup | { kind: "invalid" }): RecordStateKey {
  switch (lookup.kind) {
    case "invalid":
      return "notANumber";
    case "unavailable":
      return "notLoaded";
    case "none":
      return "noRecord";
    case "restricted":
      return "privateItem";
    case "record":
      break;
  }
  const state = lookup.dto.stateCode ?? 0;
  if (state === STATE.FLAGGED) return "reported";
  if (state === STATE.RECYCLED) return "retired";
  if (state === STATE.MINTED || state === STATE.BOUND) return "notReleased";
  if (state === STATE.ACTIVATED || state === STATE.CLAIMED) return "registered";
  return "noRecord";
}

/** The status chips after a tap. States with no product to show get none. */
export function chipsFor(state: TapStateKey): string[] {
  switch (state) {
    case "newForSale":
      return [COPY.chips.isNew, COPY.chips.forSale];
    case "newNotForSale":
      return [COPY.chips.isNew];
    case "owned":
      return [COPY.chips.owned];
    case "notReleased":
      return [COPY.chips.notReleased];
    case "reported":
      return [COPY.chips.reported];
    case "retired":
      return [COPY.chips.retired];
    default:
      return [];
  }
}

/**
 * The status chips on the record page, from the record's state. An owner can
 * list an item they own, so "Owned" and "For sale" can appear together.
 */
export function recordChips(stateCode: number | undefined, listed: boolean): string[] {
  const forSale = listed ? [COPY.chips.forSale] : [];
  switch (stateCode) {
    case STATE.ACTIVATED:
      return [COPY.chips.isNew, ...forSale];
    case STATE.CLAIMED:
      return [COPY.chips.owned, ...forSale];
    case STATE.MINTED:
    case STATE.BOUND:
      return [COPY.chips.notReleased];
    case STATE.FLAGGED:
      return [COPY.chips.reported];
    case STATE.RECYCLED:
      return [COPY.chips.retired];
    default:
      return [];
  }
}

/**
 * Where an item stands now, for its history list (see historySteps in
 * @/components/provenance-timeline). Plain words on purpose: this value is
 * handed to a browser component, so it is not a state code.
 */
export type HistoryStatus = "released" | "owned" | "reported" | "retired";

/** The history status a finished tap implies. The tap read the item just now. */
export function historyStatusOf(state: TapStateKey): HistoryStatus | undefined {
  switch (state) {
    case "newForSale":
    case "newNotForSale":
      return "released";
    case "owned":
      return "owned";
    case "reported":
      return "reported";
    case "retired":
      return "retired";
    default:
      return undefined;
  }
}

/**
 * The history status the record page implies. That page may be up to a minute
 * old, so it only passes on what cannot have been undone in the meantime: an
 * item does not go back from released or owned, and retired is final. A report
 * can be closed again, so "reported" is left to the history itself.
 */
export function recordHistoryStatus(stateCode: number | undefined): HistoryStatus | undefined {
  switch (stateCode) {
    case STATE.ACTIVATED:
      return "released";
    case STATE.CLAIMED:
      return "owned";
    case STATE.RECYCLED:
      return "retired";
    default:
      return undefined;
  }
}

/** True when the page may say the product itself checked out. */
export function isAuthenticTapState(state: TapStateKey): boolean {
  return (
    state === "newForSale" ||
    state === "newNotForSale" ||
    state === "owned" ||
    state === "privateItem"
  );
}

/**
 * "KR" → "South Korea". Anything that is not a two-letter country code is
 * shown as the brand wrote it.
 */
export function placeName(origin: string | undefined | null): string | undefined {
  const value = origin?.trim();
  if (!value) return undefined;
  if (/^[A-Za-z]{2}$/.test(value)) {
    try {
      const code = value.toUpperCase();
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      // An unassigned code comes back as itself, or as "Unknown Region".
      if (name && name !== code && name !== "Unknown Region") return name;
    } catch {
      // fall through to the raw value
    }
  }
  return value;
}

/**
 * A tag ID taken from a link, written 04:A1:…, or null when the text is not
 * shaped like one (4 to 10 bytes of hex, with or without separators). Used
 * where a page shows back part of its own address: it never echoes arbitrary
 * text from a link.
 */
export function shownTagId(fromLink: string): string | null {
  const clean = fromLink.replace(/[:\-\s]/g, "").toUpperCase();
  if (!/^(?:[0-9A-F]{2}){4,10}$/.test(clean)) return null;
  return (clean.match(/.{2}/g) ?? []).join(":");
}

/** "Sep 5, 2026", in UTC so every reader of a record sees the same day. */
export function formatDay(tsSeconds: number | undefined | null): string | undefined {
  if (!tsSeconds || !Number.isFinite(tsSeconds) || tsSeconds <= 0) return undefined;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(tsSeconds * 1000));
}

/** The product facts the page shows. Only what the record really carries. */
export interface ProductView {
  /** The product's name, or the neutral fallback when the record has none. */
  name: string;
  /** False when `name` is the fallback. */
  named: boolean;
  brand?: string;
  model?: string;
  /** Country or place of origin, written out. */
  madeIn?: string;
  /** The brand's own product code (SKU). */
  code?: string;
  description?: string;
  /** The server's price for a live listing, e.g. "$23.33". Absent otherwise. */
  price?: string;
  /** Approximate price in the display currency, when the server sent one. */
  fx?: FxApproxRender;
  /**
   * The day the item last changed, e.g. "Sep 5, 2026". The record's timestamp
   * is rewritten by the registry on every change (tag attached, released for
   * sale, bought, reported, resolved, retired, handed to a new owner), so for
   * an owned item this is the day it was bought, not the day it was made or
   * first registered. It must never be labelled as a registration date.
   */
  updatedOn?: string;
  /** A photo on an allowed image host, if the record has one. */
  photo?: { url: string; lqip?: string };
  /**
   * What the brand wrote for shoppers: size, batch, dates, how to use,
   * warnings, ingredients (TAP-T09). Absent when the record has none.
   */
  facts?: ProductFactsView;
}

const text = (value: string | undefined | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * The hero photo, only when it is on a host this app is allowed to show. Same
 * choice as heroMedia in ./services: the hero entry, else the legacy image.
 */
function photoOf(dto: AssetDto): ProductView["photo"] {
  const media: AssetMediaEntry | undefined = dto.media?.find(
    (m) => m.role === "hero" || m.role === "primary",
  );
  const url = media?.url ?? dto.image;
  if (!isAllowedImageUrl(url)) return undefined;
  return { url: url as string, ...(media?.lqip ? { lqip: media.lqip } : {}) };
}

/**
 * Product facts from an item record. A restricted or missing record gives the
 * neutral fallback and nothing else: this never brings back details the
 * services API chose to withhold.
 */
export function productViewOf(lookup: AssetLookup | null | undefined): ProductView {
  const dto = lookup?.kind === "record" ? lookup.dto : null;
  if (!dto) return { name: COPY.product.fallbackName, named: false };

  const name = text(dto.product?.name) ?? text(dto.name);
  const listed = dto.price?.saleState === "listed";
  const price = listed ? text(dto.price?.display) : undefined;
  const fx = listed ? formatFxApprox(dto.price?.fx) : null;
  const model = text(dto.product?.model);
  const photo = photoOf(dto);
  const facts = productFactsViewOf(dto.facts);

  return {
    name: name ?? COPY.product.fallbackName,
    named: name !== undefined,
    ...(text(dto.product?.brand) ? { brand: text(dto.product?.brand) } : {}),
    // A model that only repeats the name tells the shopper nothing new.
    ...(model && model !== name ? { model } : {}),
    ...(placeName(dto.product?.origin) ? { madeIn: placeName(dto.product?.origin) } : {}),
    ...(text(dto.product?.sku) ? { code: text(dto.product?.sku) } : {}),
    ...(text(dto.description) ? { description: text(dto.description) } : {}),
    ...(price ? { price } : {}),
    ...(fx ? { fx } : {}),
    ...(formatDay(dto.timestamp) ? { updatedOn: formatDay(dto.timestamp) } : {}),
    ...(photo ? { photo } : {}),
    ...(facts ? { facts } : {}),
  };
}

/**
 * The one line under the product's name: brand, size, where it was made.
 * Each part only when the record has it.
 */
export function productBasics(product: ProductView): string[] {
  return [
    ...(product.brand ? [product.brand] : []),
    ...(product.facts?.size ? [product.facts.size] : []),
    ...(product.madeIn ? [COPY.product.madeIn(product.madeIn)] : []),
  ];
}

/**
 * True when there is something of the product to put on the page. A record
 * that did not load, or that its owner keeps private, leaves only the neutral
 * name — and a card that says "This product" and nothing else tells nobody
 * anything.
 */
export function hasProductToShow(product: ProductView | undefined): product is ProductView {
  return product !== undefined && (product.named || !!product.brand || !!product.photo);
}

/**
 * What a finished tap needs from the item record to pick its state.
 *
 * `listed` is true only when a loaded record reports a live listing. A record
 * that did not load says nothing either way; the page words that case the same
 * as "not listed" (both headlines are "Authentic") and leaves the offer to buy
 * to the pricing service — see `show.buy` in ./tap-page.
 */
export function recordFactsOf(lookup: AssetLookup | null | undefined): RecordFacts {
  return {
    restricted: lookup?.kind === "restricted",
    listed: lookup?.kind === "record" && lookup.dto.price?.saleState === "listed",
  };
}

/** How product details compare with the brand's public record. */
export type DetailsCheck = "match" | "pending" | "mismatch";

/**
 * Plain-English reading of the record's integrity block. `tone` comes from
 * anchorVerdict in ./anchor-verdict, which stays the one place that decides it.
 */
export function detailsCheckOf(tone: "green" | "yellow" | "red"): DetailsCheck {
  return tone === "green" ? "match" : tone === "red" ? "mismatch" : "pending";
}

export function detailsCheckLabel(check: DetailsCheck): string {
  return check === "match"
    ? COPY.technical.detailsMatch
    : check === "mismatch"
      ? COPY.technical.detailsMismatch
      : COPY.technical.detailsPending;
}
