/**
 * Everything a shopper page is given, built from what the server knows
 * (TAP-T08). Pure: no network, no rendering.
 *
 * This is the one gate between the server's data and the page. The server
 * knows things a shopper page must not show — the owner's address, why a
 * failed check failed, internal error text. Those are simply not copied into
 * the models below, so no component downstream can render them by mistake,
 * and a unit test can check the models themselves.
 *
 * Technical values (record number, tag ID, state code, network, the link to
 * the public record) are returned only under `technical`, which the page
 * renders inside its closed "Technical details" section and nowhere else.
 */
import { anchorVerdict, newerVersionPropagating } from "./anchor-verdict";
import { COPY, type RecordStateKey, type TapStateKey } from "./consumer-copy";
import { CONTRACT_ADDRESS } from "./contract";
import { buildProductJsonLd } from "./jsonld";
import type { TapResolution } from "./resolve";
import type { AssetLookup } from "./services";
import { siteUrl } from "./site";
import { STATES } from "./states";
import {
  detailsCheckLabel,
  detailsCheckOf,
  productViewOf,
  recordChips,
  recordFactsOf,
  recordStateFor,
  tapStateFor,
  type DetailsCheck,
  type ProductView,
} from "./tap-view";

export interface TechRow {
  label: string;
  value: string;
}

export interface TechLink {
  label: string;
  href: string;
  /** Opens another site. */
  external?: boolean;
}

export interface Technical {
  rows: TechRow[];
  links: TechLink[];
}

/** How far the check got, for the frame that resolves into the verdict. */
export interface Progress {
  /** Steps that really finished (0–3). */
  done: number;
  /** Of those, how many the shopper already saw tick. */
  seen: number;
  /** How long the check took, in milliseconds. */
  tookMs: number;
}

/** The item's page on the public block explorer. */
export function publicRecordUrl(tokenId: string): string {
  return `https://sepolia.basescan.org/token/${CONTRACT_ADDRESS}?a=${tokenId}`;
}

/** Colon-format a tag ID: 04:A2:… (same as formatUid in ./resolve). */
function formatTagId(uidHex: string): string {
  return (uidHex.match(/.{1,2}/g) ?? []).join(":");
}

const stateLabel = (code: number): string => (STATES[code] ?? STATES[0]).label;

// ── After a tap ──────────────────────────────────────────────────────────────

export interface TapPageInput {
  res: TapResolution;
  /** The item record, when the tap led to an item. */
  lookup: AssetLookup | null;
  /** Steps the shopper already saw tick while waiting (from the run). */
  stepsSeen: number;
  /** How long the check took, in milliseconds. */
  tookMs: number;
  /** Route-specific technical rows and links (the GS1 route adds its own). */
  extra?: { rows: TechRow[]; links: (recordNumber: string | null) => TechLink[] };
}

export interface TapPageModel {
  state: TapStateKey;
  /** Present only when the tap led to an item. */
  product?: ProductView;
  recordNumber?: string;
  technical: Technical;
  detailsCheck?: DetailsCheck;
  /**
   * Set when the tap led to an item but its details are not on the page:
   * "private" when the owner restricted them, "unavailable" when the record
   * did not load. The verdict does not depend on either.
   */
  missingDetails?: "private" | "unavailable";
  /**
   * Set when the same phone opened this check again (TAP-T10): the whole
   * minutes since it first opened it. The page then reads as an earlier
   * check. Absent for a check opened for the first time.
   */
  repeat?: { minutesAgo: number };
  progress: Progress;
  /** Which optional parts the page shows for this state. */
  show: { buy: boolean; reviews: boolean; history: boolean };
}

const WITH_REVIEWS: ReadonlySet<TapStateKey> = new Set(["newForSale", "newNotForSale", "owned"]);
const WITH_HISTORY: ReadonlySet<TapStateKey> = new Set([
  "newForSale",
  "newNotForSale",
  "owned",
  "notReleased",
  "reported",
  "retired",
]);

export function tapPageModel({
  res,
  lookup,
  stepsSeen,
  tookMs,
  extra = { rows: [], links: () => [] },
}: TapPageInput): TapPageModel {
  const state = tapStateFor(res, recordFactsOf(lookup));
  const tagWasRead = "uid" in res;
  const done = res.kind === "resolved" ? 3 : tagWasRead ? 1 : 0;
  const progress: Progress = { done, seen: Math.min(done, stepsSeen), tookMs };

  // Rows every checked tag has, whatever the outcome.
  const tagRows: TechRow[] = tagWasRead
    ? [
        { label: COPY.technical.timesChecked, value: String(res.counter) },
        { label: COPY.technical.network, value: COPY.technical.networkValue },
        { label: COPY.technical.tagId, value: formatTagId(res.uid) },
      ]
    : [];

  if (res.kind !== "resolved") {
    // A failed check carries a reason; a failed lookup carries an error text.
    // Neither is copied: the state alone is what the shopper is told.
    return {
      state,
      technical: { rows: [...tagRows, ...extra.rows], links: extra.links(null) },
      progress,
      show: { buy: false, reviews: false, history: false },
    };
  }

  const tokenId = res.tokenId.toString();
  const record = lookup?.kind === "record" ? lookup.dto : null;
  const check = record ? detailsCheckOf(anchorVerdict(record.verification).tone) : undefined;

  const rows: TechRow[] = [
    { label: COPY.technical.recordNumber, value: tokenId },
    ...tagRows,
    {
      label: COPY.technical.recordState,
      value: `${stateLabel(res.asset.state)} (${res.asset.state})`,
    },
    ...(check ? [{ label: COPY.technical.productDetails, value: detailsCheckLabel(check) }] : []),
    ...(res.metadataHash
      ? [{ label: COPY.technical.recordFingerprint, value: `${res.metadataHash.slice(0, 18)}…` }]
      : []),
    ...extra.rows,
  ];
  const links: TechLink[] = [
    { label: COPY.technical.viewPublicRecord, href: publicRecordUrl(tokenId), external: true },
    { label: COPY.technical.recordPage, href: `/asset/${tokenId}` },
    ...extra.links(tokenId),
  ];

  return {
    state,
    product: productViewOf(lookup),
    recordNumber: tokenId,
    technical: { rows, links },
    ...(check ? { detailsCheck: check } : {}),
    ...(record
      ? {}
      : {
          missingDetails:
            lookup?.kind === "restricted" ? ("private" as const) : ("unavailable" as const),
        }),
    ...(res.link.kind === "again"
      ? { repeat: { minutesAgo: Math.floor(res.link.secondsAgo / 60) } }
      : {}),
    progress,
    show: {
      // The buy widget asks the pricing service itself and shows only for a
      // live listing. It is offered where the record says the item is listed,
      // and also where the record did not load: then the listing is simply
      // not known, and a failed lookup must not take a purchase away.
      buy: state === "newForSale" || (state === "newNotForSale" && record === null),
      // Reviews and history belong to a product the page can show; without
      // its record there is nothing to hang them on.
      reviews: record !== null && WITH_REVIEWS.has(state),
      history: record !== null && WITH_HISTORY.has(state),
    },
  };
}

// ── The record page ──────────────────────────────────────────────────────────

/** UTC only: a record's time should read the same for every reader. */
function formatUtc(tsSeconds: number): string {
  return `${new Date(tsSeconds * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export interface RecordPageModel {
  state: RecordStateKey;
  product?: ProductView;
  chips: string[];
  recordNumber?: string;
  technical?: Technical;
  detailsCheck?: DetailsCheck;
  /** The page's one structured-data block, or null when it must not carry one. */
  jsonLd: Record<string, unknown> | null;
  /** The record's state number, for the buy island (it offers a purchase for 3 only). */
  stateCode: number;
}

export function recordPageModel(
  lookup: AssetLookup | { kind: "invalid" },
  tokenId: string,
): RecordPageModel {
  const state = recordStateFor(lookup);
  const base = { state, chips: [], jsonLd: null, stateCode: 0 };

  // A link that is not a record number: nothing technical to show at all.
  if (lookup.kind === "invalid") return base;

  const recordRow: TechRow = { label: COPY.technical.recordNumber, value: tokenId };
  const networkRow: TechRow = {
    label: COPY.technical.network,
    value: COPY.technical.networkValue,
  };

  // "No record" is a real, honest answer, not an error. A protected item gets
  // a minimal page too: NO product copy, NO JSON-LD.
  if (lookup.kind !== "record") {
    return {
      ...base,
      recordNumber: tokenId,
      technical: { rows: [recordRow, networkRow], links: [] },
    };
  }

  const { dto } = lookup;
  const stateCode = dto.stateCode ?? 0;
  const product = productViewOf(lookup);
  const check = detailsCheckOf(anchorVerdict(dto.verification).tone);
  const propagating = newerVersionPropagating(dto.verification);

  return {
    state,
    product,
    chips: recordChips(stateCode, product.price !== undefined),
    recordNumber: tokenId,
    technical: {
      rows: [
        recordRow,
        networkRow,
        { label: COPY.technical.recordState, value: `${stateLabel(stateCode)} (${stateCode})` },
        ...(dto.timestamp
          ? [{ label: COPY.technical.updated, value: formatUtc(dto.timestamp) }]
          : []),
        {
          label: COPY.technical.productDetails,
          // The check stays the authoritative statement; a newer version still
          // on its way is added to it, never put in its place.
          value: propagating
            ? `${detailsCheckLabel(check)}. ${COPY.technical.detailsUpdating}`
            : detailsCheckLabel(check),
        },
      ],
      links: [
        { label: COPY.technical.viewPublicRecord, href: publicRecordUrl(tokenId), external: true },
      ],
    },
    detailsCheck: check,
    jsonLd: buildProductJsonLd({ url: siteUrl(`/asset/${tokenId}`), dto }),
    stateCode,
  };
}
