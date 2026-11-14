import { afterEach, describe, expect, it, vi } from "vitest";

import { createTapTimer, formatServerTiming, logTap } from "../tap-timing";

/** A clock the test advances by hand. */
function fakeClock(start = 1_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatServerTiming", () => {
  it("emits spans in a fixed order with one decimal", () => {
    expect(
      formatServerTiming({ total: 262.14, product: 140.26, sdm: 0.44, chain: 58, tag: 61.25 }),
    ).toBe("sdm;dur=0.4, tag;dur=61.3, chain;dur=58.0, product;dur=140.3, total;dur=262.1");
  });

  it("drops spans that were never recorded or are not real numbers", () => {
    expect(formatServerTiming({ sdm: 1, total: 3 })).toBe("sdm;dur=1.0, total;dur=3.0");
    expect(formatServerTiming({ sdm: Number.NaN, tag: -1, total: 2 })).toBe("total;dur=2.0");
    expect(formatServerTiming({})).toBe("");
  });
});

describe("createTapTimer", () => {
  it("times sync and async steps and reports total up to the call", async () => {
    const clock = fakeClock();
    const timer = createTapTimer(clock.now);

    const sync = timer.timeSync("sdm", () => {
      clock.advance(2);
      return "ok";
    });
    const tokenId = await timer.time("tag", async () => {
      clock.advance(60);
      return 58n;
    });
    clock.advance(5);

    expect(sync).toBe("ok");
    expect(tokenId).toBe(58n);
    expect(timer.spans()).toEqual({ sdm: 2, tag: 60, total: 67 });
    expect(timer.header()).toBe("sdm;dur=2.0, tag;dur=60.0, total;dur=67.0");
  });

  it("records the span even when the step rejects, and lets the rejection through", async () => {
    const clock = fakeClock();
    const timer = createTapTimer(clock.now);

    await expect(
      timer.time("chain", async () => {
        clock.advance(40);
        throw new Error("rpc down");
      }),
    ).rejects.toThrow("rpc down");

    expect(timer.spans().chain).toBe(40);
  });

  it("accumulates a span that is timed more than once", async () => {
    const clock = fakeClock();
    const timer = createTapTimer(clock.now);

    await timer.time("product", async () => clock.advance(100));
    await timer.time("product", async () => clock.advance(30));

    expect(timer.spans().product).toBe(130);
  });

  it("overlapping steps each keep their own duration", async () => {
    const clock = fakeClock();
    const timer = createTapTimer(clock.now);

    let finishProduct!: () => void;
    const product = timer.time(
      "product",
      () => new Promise<void>((resolve) => (finishProduct = resolve)),
    );
    await timer.time("chain", async () => clock.advance(50));
    clock.advance(90);
    finishProduct();
    await product;

    expect(timer.spans()).toMatchObject({ chain: 50, product: 140, total: 140 });
  });
});

describe("logTap", () => {
  it("writes one line with the route, the outcome and whole milliseconds — nothing else", async () => {
    const clock = fakeClock();
    const timer = createTapTimer(clock.now);
    await timer.time("tag", async () => clock.advance(61.4));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    logTap("/sun", "resolved", timer);

    expect(log).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(log.mock.calls[0]![0]));
    expect(line).toEqual({
      evt: "tap",
      route: "/sun",
      outcome: "resolved",
      ms: { tag: 61, total: 61 },
    });
  });
});
