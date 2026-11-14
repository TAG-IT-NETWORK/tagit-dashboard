/**
 * Per-tap timing (TAP-T06): where does a tap's server time go?
 *
 * A tap is rendered per request and never cached, so its speed is the sum of a
 * few awaited steps. This records how long each one took, so "the tap is slow"
 * becomes a measurement instead of a guess:
 *
 *   sdm      decode and check the tag's code (local CPU, no network)
 *   tag      chain read: tag → item number
 *   chain    chain reads: item state + record hash (issued together)
 *   product  the item record from tagit-services (lean view)
 *   total    start to finish
 *
 * Where the numbers go:
 *   - JSON tap routes send them as a `Server-Timing` response header.
 *   - HTML tap pages cannot set a response header from a server component, so
 *     they carry the same string in a `data-tap-timing` attribute on <main>
 *     and write one log line per tap.
 *
 * Durations and the outcome only. Never the tag's code, a UID or an address.
 */

export type TapSpan = "sdm" | "tag" | "chain" | "product" | "total";

export type TapSpans = Partial<Record<TapSpan, number>>;

export interface TapTimer {
  /** Time an async step. Its result — or its rejection — passes through untouched. */
  time<T>(span: TapSpan, step: () => Promise<T>): Promise<T>;
  /** Time a synchronous step. */
  timeSync<T>(span: TapSpan, step: () => T): T;
  /** Milliseconds per recorded span, plus `total` measured up to this call. */
  spans(): TapSpans;
  /** The spans as a Server-Timing value, e.g. `sdm;dur=0.4, tag;dur=61.2, total;dur=262.1`. */
  header(): string;
}

const SPAN_ORDER: readonly TapSpan[] = ["sdm", "tag", "chain", "product", "total"];

/** Format spans as a Server-Timing header value, in a fixed order, one decimal. */
export function formatServerTiming(spans: TapSpans): string {
  return SPAN_ORDER.filter((name) => {
    const value = spans[name];
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  })
    .map((name) => `${name};dur=${(spans[name] as number).toFixed(1)}`)
    .join(", ");
}

/**
 * Start a timer for one tap. `now` is injectable so tests can drive the clock.
 * A span timed more than once accumulates.
 */
export function createTapTimer(now: () => number = () => performance.now()): TapTimer {
  const startedAt = now();
  const recorded: TapSpans = {};

  const record = (span: TapSpan, from: number) => {
    recorded[span] = (recorded[span] ?? 0) + (now() - from);
  };
  const spans = (): TapSpans => ({ ...recorded, total: now() - startedAt });

  return {
    async time(span, step) {
      const from = now();
      try {
        return await step();
      } finally {
        record(span, from);
      }
    },
    timeSync(span, step) {
      const from = now();
      try {
        return step();
      } finally {
        record(span, from);
      }
    },
    spans,
    header: () => formatServerTiming(spans()),
  };
}

/**
 * One structured log line per tap: the route, the outcome and whole-millisecond
 * durations. Nothing that identifies the tag or the person tapping.
 */
export function logTap(route: string, outcome: string, timer: TapTimer): void {
  const ms: Record<string, number> = {};
  for (const [name, value] of Object.entries(timer.spans())) {
    if (typeof value === "number" && Number.isFinite(value)) ms[name] = Math.round(value);
  }
  console.log(JSON.stringify({ evt: "tap", route, outcome, ms }));
}
