import { describe, expect, it } from "vitest";

import { COPY } from "../consumer-copy";
import { CONTRACT_ADDRESS } from "../contract";
import { buildProductJsonLd } from "../jsonld";
import type { TapResolution } from "../resolve";
import type { AssetLookup } from "../services";
import { siteUrl } from "../site";
import { publicRecordUrl, recordPageModel, tapPageModel } from "../tap-page";
import {
  BROKEN_LOOKUP_TAP,
  FAILED_TAP,
  FAIL_REASON,
  FINGERPRINT,
  LOOKUP_ERROR,
  OWNER,
  OWNER_SHORT,
  RECORD_NUMBER,
  RESTRICTED,
  SELLER,
  STATE,
  TAG_ID_SHOWN,
  UNLINKED_TAP,
  record,
  recordDto,
  resolvedTap,
} from "../../test-support/shopper-fixtures";

/**
 * TAP-T08: the one gate between what the server knows and what a shopper page
 * is given. The inputs here carry an owner address, a seller address and the
 * reason a check failed; the models must carry none of them.
 */

const tap = (res: TapResolution, lookup: AssetLookup | null = null) =>
  tapPageModel({ res, lookup, stepsSeen: 1, tookMs: 250 });

const rowsOf = (model: { technical?: { rows: { label: string; value: string }[] } }) =>
  Object.fromEntries((model.technical?.rows ?? []).map((r) => [r.label, r.value]));

const EVERY_TAP: [string, TapResolution, AssetLookup | null][] = [
  ["new, for sale", resolvedTap(STATE.ACTIVATED), record(STATE.ACTIVATED, true)],
  ["new, not for sale", resolvedTap(STATE.ACTIVATED), record(STATE.ACTIVATED)],
  ["owned", resolvedTap(STATE.CLAIMED), record(STATE.CLAIMED)],
  ["owned, listed again", resolvedTap(STATE.CLAIMED), record(STATE.CLAIMED, true)],
  ["not released", resolvedTap(STATE.BOUND), record(STATE.BOUND)],
  ["reported", resolvedTap(STATE.FLAGGED), record(STATE.FLAGGED)],
  ["retired", resolvedTap(STATE.RECYCLED), record(STATE.RECYCLED)],
  ["private", resolvedTap(STATE.CLAIMED), RESTRICTED],
  ["record service down", resolvedTap(STATE.ACTIVATED), { kind: "unavailable" }],
  ["no record on file", resolvedTap(STATE.ACTIVATED), { kind: "none" }],
  ["check failed", FAILED_TAP, null],
  ["no item for this tag", UNLINKED_TAP, null],
  ["lookup failed", BROKEN_LOOKUP_TAP, null],
  ["not set up", { kind: "not-configured" }, null],
  ["incomplete link", { kind: "bad-params" }, null],
];

describe("tapPageModel", () => {
  it.each(EVERY_TAP)("%s: carries no owner, no seller, no failure reason", (_name, res, lookup) => {
    const json = JSON.stringify(tap(res, lookup));
    for (const secret of [
      OWNER,
      OWNER.toLowerCase(),
      OWNER_SHORT,
      OWNER.slice(0, 8),
      SELLER,
      FAIL_REASON,
      LOOKUP_ERROR,
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it.each(EVERY_TAP)("%s: every 0x value sits under `technical`", (_name, res, lookup) => {
    const { technical: _technical, ...rest } = tap(res, lookup);
    expect(JSON.stringify(rest)).not.toMatch(/0x[0-9a-fA-F]{4,}/);
  });

  it("puts the record number, tag ID, state code, network and fingerprint in the drawer", () => {
    const model = tap(resolvedTap(STATE.CLAIMED), record(STATE.CLAIMED));
    expect(rowsOf(model)).toEqual({
      [COPY.technical.recordNumber]: RECORD_NUMBER,
      [COPY.technical.timesChecked]: "42",
      [COPY.technical.network]: COPY.technical.networkValue,
      [COPY.technical.tagId]: TAG_ID_SHOWN,
      [COPY.technical.recordState]: "CLAIMED (4)",
      [COPY.technical.productDetails]: COPY.technical.detailsMatch,
      [COPY.technical.recordFingerprint]: `${FINGERPRINT.slice(0, 18)}…`,
    });
    expect(model.technical.links).toEqual([
      {
        label: COPY.technical.viewPublicRecord,
        href: `https://sepolia.basescan.org/token/${CONTRACT_ADDRESS}?a=${RECORD_NUMBER}`,
        external: true,
      },
      { label: COPY.technical.recordPage, href: `/asset/${RECORD_NUMBER}` },
    ]);
    expect(model.recordNumber).toBe(RECORD_NUMBER);
  });

  it("gives a tag with no item its tag rows and nothing about a record", () => {
    const model = tap(UNLINKED_TAP);
    expect(rowsOf(model)).toEqual({
      [COPY.technical.timesChecked]: "42",
      [COPY.technical.network]: COPY.technical.networkValue,
      [COPY.technical.tagId]: TAG_ID_SHOWN,
    });
    expect(model.technical.links).toEqual([]);
    expect(model.recordNumber).toBeUndefined();
    expect(model.product).toBeUndefined();
  });

  it("gives a failed check and an incomplete link nothing technical at all", () => {
    for (const res of [
      FAILED_TAP,
      { kind: "bad-params" } as const,
      { kind: "not-configured" } as const,
    ]) {
      const model = tap(res);
      expect(model.technical).toEqual({ rows: [], links: [] });
      expect(model.product).toBeUndefined();
      expect(model.show).toEqual({ buy: false, reviews: false, history: false });
    }
  });

  it("offers to buy only an item that is new and listed", () => {
    const buyable = EVERY_TAP.filter(([, res, lookup]) => tap(res, lookup).show.buy).map(
      ([n]) => n,
    );
    expect(buyable).toEqual(["new, for sale"]);
  });

  it("shows reviews and history only where the page has a product to show", () => {
    const show = (name: string) => {
      const [, res, lookup] = EVERY_TAP.find(([n]) => n === name)!;
      return tap(res, lookup).show;
    };
    expect(show("owned")).toEqual({ buy: false, reviews: true, history: true });
    expect(show("not released")).toEqual({ buy: false, reviews: false, history: true });
    expect(show("reported")).toEqual({ buy: false, reviews: false, history: true });
    expect(show("retired")).toEqual({ buy: false, reviews: false, history: true });
    expect(show("private")).toEqual({ buy: false, reviews: false, history: false });
    // no record came back: nothing to hang reviews or a history on
    expect(show("record service down")).toEqual({ buy: false, reviews: false, history: false });
    expect(show("no record on file")).toEqual({ buy: false, reviews: false, history: false });
  });

  it("says why an item's details are missing, and only then", () => {
    const missing = (name: string) => {
      const [, res, lookup] = EVERY_TAP.find(([n]) => n === name)!;
      return tap(res, lookup).missingDetails;
    };
    expect(missing("record service down")).toBe("unavailable");
    expect(missing("no record on file")).toBe("unavailable");
    expect(missing("private")).toBe("private");
    for (const name of [
      "new, for sale",
      "owned",
      "reported",
      "check failed",
      "no item for this tag",
    ]) {
      expect(missing(name)).toBeUndefined();
    }
  });

  it("reports how far the check got, never more than really finished", () => {
    expect(tap(resolvedTap(STATE.CLAIMED), record(STATE.CLAIMED)).progress).toEqual({
      done: 3,
      seen: 1,
      tookMs: 250,
    });
    expect(tap(UNLINKED_TAP).progress.done).toBe(1);
    expect(tap(BROKEN_LOOKUP_TAP).progress.done).toBe(1);
    expect(tap(FAILED_TAP).progress.done).toBe(0);
    expect(tap({ kind: "bad-params" }).progress.done).toBe(0);
    // steps the shopper "saw" cannot exceed the steps that finished
    const failed = tapPageModel({ res: FAILED_TAP, lookup: null, stepsSeen: 3, tookMs: 10 });
    expect(failed.progress).toEqual({ done: 0, seen: 0, tookMs: 10 });
  });

  it("says when product details do not match the brand's record", () => {
    const dto = recordDto(STATE.ACTIVATED, true);
    dto.verification = { ...dto.verification!, verified: false };
    const model = tap(resolvedTap(STATE.ACTIVATED), { kind: "record", dto });
    expect(model.detailsCheck).toBe("mismatch");
    expect(rowsOf(model)[COPY.technical.productDetails]).toBe(COPY.technical.detailsMismatch);
    // no record, no statement about its details
    expect(tap(resolvedTap(STATE.ACTIVATED), RESTRICTED).detailsCheck).toBeUndefined();
  });

  it("adds a route's own rows and links, built from the record number", () => {
    const extra = {
      rows: [{ label: COPY.technical.productNumber, value: "09506000134352" }],
      links: (recordNumber: string | null) => [
        { label: COPY.technical.machinePassport, href: `/api/dpp/token/${recordNumber ?? "none"}` },
      ],
    };
    const found = tapPageModel({
      res: resolvedTap(STATE.CLAIMED),
      lookup: record(STATE.CLAIMED),
      stepsSeen: 0,
      tookMs: 1,
      extra,
    });
    expect(found.technical.rows.at(-1)).toEqual(extra.rows[0]);
    expect(found.technical.links.at(-1)?.href).toBe(`/api/dpp/token/${RECORD_NUMBER}`);

    const missing = tapPageModel({
      res: UNLINKED_TAP,
      lookup: null,
      stepsSeen: 0,
      tookMs: 1,
      extra,
    });
    expect(missing.technical.rows.at(-1)).toEqual(extra.rows[0]);
    expect(missing.technical.links).toEqual([
      { label: COPY.technical.machinePassport, href: "/api/dpp/token/none" },
    ]);
  });
});

describe("publicRecordUrl", () => {
  it("points at the item on the public explorer", () => {
    expect(publicRecordUrl("58")).toBe(
      `https://sepolia.basescan.org/token/${CONTRACT_ADDRESS}?a=58`,
    );
  });
});

describe("recordPageModel", () => {
  const EVERY_RECORD: [string, AssetLookup | { kind: "invalid" }][] = [
    ["new, for sale", record(STATE.ACTIVATED, true)],
    ["owned", record(STATE.CLAIMED)],
    ["not released", record(STATE.BOUND)],
    ["reported", record(STATE.FLAGGED)],
    ["retired", record(STATE.RECYCLED)],
    ["private", RESTRICTED],
    ["no record", { kind: "none" }],
    ["not loaded", { kind: "unavailable" }],
    ["not a number", { kind: "invalid" }],
  ];

  it.each(EVERY_RECORD)("%s: carries no owner and no seller", (_name, lookup) => {
    const json = JSON.stringify(recordPageModel(lookup, RECORD_NUMBER));
    for (const secret of [OWNER, OWNER.toLowerCase(), OWNER_SHORT, OWNER.slice(0, 8), SELLER]) {
      expect(json).not.toContain(secret);
    }
  });

  it("builds the structured-data block exactly as before", () => {
    const dto = recordDto(STATE.ACTIVATED, true);
    const model = recordPageModel({ kind: "record", dto }, RECORD_NUMBER);
    expect(model.jsonLd).toEqual(
      buildProductJsonLd({ url: siteUrl(`/asset/${RECORD_NUMBER}`), dto }),
    );
    expect(JSON.stringify(model.jsonLd)).toBe(
      JSON.stringify(buildProductJsonLd({ url: siteUrl(`/asset/${RECORD_NUMBER}`), dto })),
    );
  });

  it("gives no structured data when there is no public product to describe", () => {
    for (const lookup of [
      RESTRICTED,
      { kind: "none" },
      { kind: "unavailable" },
      { kind: "invalid" },
    ] as const) {
      expect(recordPageModel(lookup, RECORD_NUMBER).jsonLd).toBeNull();
    }
  });

  it("gives a private item no product facts at all", () => {
    const model = recordPageModel(RESTRICTED, RECORD_NUMBER);
    expect(model.state).toBe("privateItem");
    expect(model.product).toBeUndefined();
    expect(model.chips).toEqual([]);
    expect(rowsOf(model)).toEqual({
      [COPY.technical.recordNumber]: RECORD_NUMBER,
      [COPY.technical.network]: COPY.technical.networkValue,
    });
  });

  it("gives a link that is not a number nothing technical", () => {
    const model = recordPageModel({ kind: "invalid" }, "abc");
    expect(model).toEqual({ state: "notANumber", chips: [], jsonLd: null, stateCode: 0 });
  });

  it("puts the state code and the registration time in the drawer only", () => {
    const model = recordPageModel(record(STATE.CLAIMED), RECORD_NUMBER);
    expect(rowsOf(model)).toEqual({
      [COPY.technical.recordNumber]: RECORD_NUMBER,
      [COPY.technical.network]: COPY.technical.networkValue,
      [COPY.technical.recordState]: "CLAIMED (4)",
      [COPY.technical.registered]: "2026-09-05 09:30:00 UTC",
      [COPY.technical.productDetails]: COPY.technical.detailsMatch,
    });
    const { technical: _technical, jsonLd: _jsonLd, ...visible } = model;
    expect(JSON.stringify(visible)).not.toMatch(/CLAIMED|0x[0-9a-fA-F]{4,}/);
    // the buy island still needs the state number; it is a number, not a label
    expect(model.stateCode).toBe(STATE.CLAIMED);
  });

  it("marks an owned item that is listed again as owned and for sale", () => {
    expect(recordPageModel(record(STATE.CLAIMED, true), RECORD_NUMBER).chips).toEqual([
      COPY.chips.owned,
      COPY.chips.forSale,
    ]);
    expect(recordPageModel(record(STATE.ACTIVATED), RECORD_NUMBER).chips).toEqual([
      COPY.chips.isNew,
    ]);
  });

  it("keeps the details check when a newer version is still being recorded", () => {
    const dto = recordDto(STATE.ACTIVATED);
    dto.verification = { ...dto.verification!, latestVersion: 3 };
    const row = rowsOf(recordPageModel({ kind: "record", dto }, RECORD_NUMBER))[
      COPY.technical.productDetails
    ];
    expect(row).toContain(COPY.technical.detailsMatch);
    expect(row).toContain(COPY.technical.detailsUpdating);
  });
});
