import { describe, expect, it, vi } from "vitest";

import type { RatingsView } from "../ratings";
import type { AssetLookup } from "../services";
import { startTapLookups, type TapLookupSources } from "../tap-lookups";
import { createTapTimer } from "../tap-timing";

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let every already-queued promise callback run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const RECORD: AssetLookup = {
  kind: "record",
  dto: { tokenId: "58", stateCode: 4, name: "Renewal Cream" },
};
const RATINGS = { tokenId: "58" } as unknown as RatingsView;

/** Sources the test controls, plus a count of requests in flight at once. */
function controlledSources() {
  const record = deferred<AssetLookup>();
  const ratings = deferred<RatingsView | null>();
  let inFlight = 0;
  let mostInFlight = 0;
  const track = <T>(promise: Promise<T>): Promise<T> => {
    inFlight += 1;
    mostInFlight = Math.max(mostInFlight, inFlight);
    return promise.finally(() => {
      inFlight -= 1;
    });
  };
  const sources: TapLookupSources = {
    fetchAsset: vi.fn((_tokenId: string) => track(record.promise)),
    fetchRatings: vi.fn((_tokenId: string) => track(ratings.promise)),
  };
  return { sources, record, ratings, mostInFlight: () => mostInFlight };
}

describe("startTapLookups (TAP-T06)", () => {
  it("asks for the record at once, and for ratings only after the record has landed", async () => {
    const { sources, record, ratings } = controlledSources();

    const lookups = startTapLookups("58", createTapTimer(), sources);
    await settle();

    expect(sources.fetchAsset).toHaveBeenCalledExactlyOnceWith("58");
    expect(sources.fetchRatings).not.toHaveBeenCalled();

    record.resolve(RECORD);
    await settle();

    expect(sources.fetchRatings).toHaveBeenCalledExactlyOnceWith("58");

    ratings.resolve(RATINGS);
    await expect(lookups.product).resolves.toBe(RECORD);
    await expect(lookups.ratings).resolves.toBe(RATINGS);
  });

  it("never has two services requests in flight for one tap", async () => {
    const { sources, record, ratings, mostInFlight } = controlledSources();

    const lookups = startTapLookups("58", createTapTimer(), sources);
    await settle();
    record.resolve(RECORD);
    await settle();
    ratings.resolve(null);
    await lookups.ratings;

    expect(mostInFlight()).toBe(1);
  });

  it("still loads ratings when the record lookup fails", async () => {
    const { sources, record, ratings } = controlledSources();

    const lookups = startTapLookups("58", createTapTimer(), sources);
    const product = expect(lookups.product).rejects.toThrow("services down");
    record.reject(new Error("services down"));
    await product;
    await settle();

    expect(sources.fetchRatings).toHaveBeenCalledExactlyOnceWith("58");
    ratings.resolve(RATINGS);
    await expect(lookups.ratings).resolves.toBe(RATINGS);
  });

  it("ratings never reject — a failure is just no ratings", async () => {
    const { sources, record, ratings } = controlledSources();

    const lookups = startTapLookups("58", createTapTimer(), sources);
    record.resolve(RECORD);
    ratings.reject(new Error("ratings exploded"));

    await expect(lookups.ratings).resolves.toBeNull();
  });

  it("times the record as the product span, and leaves ratings out of it", async () => {
    let clock = 1_000;
    const timer = createTapTimer(() => clock);
    const { sources, record, ratings } = controlledSources();

    const lookups = startTapLookups("58", timer, sources);
    clock += 140;
    record.resolve(RECORD);
    await lookups.product;
    clock += 900; // ratings are slow; the product span must not grow
    ratings.resolve(null);
    await lookups.ratings;

    expect(timer.spans().product).toBe(140);
  });
});
