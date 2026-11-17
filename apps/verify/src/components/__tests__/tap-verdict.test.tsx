import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TapResolution } from "@/lib/resolve";
import type { AssetLookup } from "@/lib/services";
import type { TapLookups } from "@/lib/tap-lookups";
import type { TapRun } from "@/lib/tap-run";
import { createTapTimer } from "@/lib/tap-timing";
import {
  AGAIN,
  STATE,
  UNCHECKED_LINK_TAP,
  USED_LINK_TAP,
  record,
  resolvedTap,
} from "@/test-support/shopper-fixtures";

import { TapResult, type TapResultProps } from "../tap-result";
import { TapVerdict } from "../tap-verdict";

/**
 * TAP-T10: the server half of a finished tap hands the page what the check
 * found about the link — the mark of an earlier check, or the used-link state
 * with nothing about any product. (What the page then shows is tested in
 * tap-result.test.tsx; this pins that it is told.)
 */

function runOf(res: TapResolution, lookup: AssetLookup | null): TapRun<TapLookups> {
  const lookups: TapLookups | undefined = lookup
    ? { product: Promise.resolve(lookup), ratings: Promise.resolve(null) }
    : undefined;
  return {
    timer: createTapTimer(),
    tagRead: true,
    resolution: Promise.resolve(res),
    confirmed: Promise.resolve(res.kind === "resolved"),
    secondTick: Promise.resolve(res.kind === "resolved"),
    item: () => lookups,
    stepsSeen: () => 1,
  };
}

async function verdict(res: TapResolution, lookup: AssetLookup | null = null) {
  const element = await TapVerdict({ run: runOf(res, lookup), route: "/sun", retryHref: "/sun?x" });
  expect(isValidElement(element)).toBe(true);
  expect((element as ReactElement).type).toBe(TapResult);
  return (element as ReactElement<TapResultProps>).props;
}

let logged: string[];

beforeEach(() => {
  logged = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logged.push(String(line));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<TapVerdict> — what the page is told about the link", () => {
  it("a first look: no mark of an earlier check", async () => {
    const props = await verdict(resolvedTap(STATE.CLAIMED), record(STATE.CLAIMED));

    expect(props.state).toBe("owned");
    expect(props.repeat).toBeUndefined();
    expect(JSON.parse(logged[0]!).outcome).toBe("resolved");
  });

  it("the same phone again: the same state, marked with the whole minutes since", async () => {
    const props = await verdict(resolvedTap(STATE.CLAIMED, AGAIN), record(STATE.CLAIMED));

    expect(props.state).toBe("owned");
    expect(props.repeat).toEqual({ minutesAgo: 3 });
    expect(props.product?.name).toBe("Renewal Cream");
    // told apart from a first look in the tap log
    expect(JSON.parse(logged[0]!).outcome).toBe("resolved-again");
  });

  it("a used link: the expired state, and nothing about any product", async () => {
    const props = await verdict(USED_LINK_TAP);

    expect(props.state).toBe("linkUsed");
    expect(props.product).toBeUndefined();
    expect(props.recordNumber).toBeUndefined();
    expect(props.repeat).toBeUndefined();
    expect(props.slots).toBeUndefined();
    expect(JSON.parse(logged[0]!).outcome).toBe("link-used");
  });

  it("a link that could not be checked: our side, and nothing about any product", async () => {
    const props = await verdict(UNCHECKED_LINK_TAP);

    expect(props.state).toBe("ourSide");
    expect(props.product).toBeUndefined();
    expect(props.slots).toBeUndefined();
    expect(props.retryHref).toBe("/sun?x");
    expect(JSON.parse(logged[0]!).outcome).toBe("link-unchecked");
  });

  it("writes nothing to the tap log that names the tag or the device", async () => {
    await verdict(resolvedTap(STATE.CLAIMED, AGAIN), record(STATE.CLAIMED));
    await verdict(USED_LINK_TAP);

    for (const line of logged) {
      expect(Object.keys(JSON.parse(line)).sort()).toEqual(["evt", "ms", "outcome", "route"]);
    }
  });
});
