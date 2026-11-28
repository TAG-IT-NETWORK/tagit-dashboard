import "server-only";

import { resolveTap, type TapResolution } from "./resolve";
import { createTapTimer, type TapTimer } from "./tap-timing";

/**
 * One tap, started but not awaited (TAP-T07).
 *
 * A tap page shows its frame at once and fills it in as the work finishes. To
 * do that the page must not wait for the check before it renders: it starts
 * the run here, hands the run to the parts of the page that depend on it, and
 * returns. The three steps the shopper sees map onto real work:
 *
 *   Reading the tag             the tag's code decoded and checked (`tagRead`)
 *   Confirming it's authentic   the chain has answered (`confirmed`)
 *   Finding the product record  the item record has arrived (the verdict)
 *
 * A step is only ever shown as done after its work has really finished.
 */
export interface TapRun<T> {
  timer: TapTimer;
  /**
   * The tag's code was decoded and passed its check. Known the moment the run
   * starts (that check is local and synchronous), so the frame's first step is
   * already ticked when the frame first appears.
   */
  tagRead: boolean;
  /** Everything the verdict is built from. */
  resolution: Promise<TapResolution>;
  /**
   * Settles when the chain has answered: `true` when it confirmed an item for
   * this tag, `false` when it did not (no item, or the read failed). Never
   * rejects.
   */
  confirmed: Promise<boolean>;
  /**
   * When to tick the second step while the frame is still up: `confirmed`,
   * held back by TICK_GRACE_MS. On a normal tap the verdict arrives inside
   * that grace and the frame's last moments tick both remaining steps
   * together; this only fires when the record is slow, which is exactly when
   * the shopper should see that the first two steps are done. Never rejects.
   */
  secondTick: Promise<boolean>;
  /** What `onItem` returned. Undefined until the tag has resolved to an item. */
  item(): T | undefined;
  /**
   * How many steps (0–2) had been ticked on the shopper's screen for a moment
   * before the verdict arrived. The verdict replays the remaining ticks; the
   * ones already seen stay still instead of blinking.
   */
  stepsSeen(): number;
}

/**
 * Hold the second tick back this long after the chain answers.
 *
 * Why not tick at once: the browser reveals streamed updates no closer than
 * 300 ms apart (React's own pacing). A tick sent the instant the chain answers
 * would therefore hold the verdict back by up to 300 ms on a normal tap, where
 * the record lands a moment later. Waiting first means a normal tap sends no
 * separate tick at all — the verdict shows as soon as it exists — and a slow
 * record still gets its tick while the shopper waits.
 */
export const TICK_GRACE_MS = 300;

/**
 * A tick has to be on screen about this long before the verdict lands for the
 * shopper to have seen it. Shorter than that and replaying it is smoother than
 * keeping it still.
 */
export const TICK_SEEN_AFTER_MS = 120;

const defaultWait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    // unref: a tick nobody is waiting for must not keep the process busy.
    setTimeout(resolve, ms).unref?.();
  });

/**
 * Start a tap. Returns at once; nothing here waits for the network.
 *
 * `onItem` is called once the tag has resolved to an item and its link may be
 * shown — while the item-state reads are still out — and starts the page's
 * own lookup (the item record). Whatever it returns is available later from
 * `item()`. It is not called for a link that was already used.
 *
 * `device` is the requesting device (see @/lib/tap-device). It lets the same
 * phone open its own link again for a few minutes; without it the link is
 * still opened, once.
 */
export function startTapRun<T>(
  picc: string,
  cmac: string,
  onItem: (tokenId: string, timer: TapTimer) => T,
  options: {
    device?: string | null;
    /** The shopper's country (see @/lib/tap-country), for the brand's tap numbers. */
    country?: string | null;
    now?: () => number;
    wait?: (ms: number) => Promise<void>;
  } = {},
): TapRun<T> {
  const now = options.now ?? (() => performance.now());
  const wait = options.wait ?? defaultWait;
  const timer = createTapTimer(now);
  let tagRead = false;
  let item: T | undefined;
  let confirmedAt: number | undefined;

  const resolution = resolveTap(picc, cmac, {
    onTagRead: () => {
      tagRead = true;
    },
    onTokenId: (tokenId) => {
      item = onItem(tokenId.toString(), timer);
    },
    timer,
    device: options.device ?? null,
    ...(options.country ? { country: options.country } : {}),
  });

  const confirmed = resolution.then(
    (res) => {
      if (res.kind !== "resolved") return false;
      confirmedAt = now();
      return true;
    },
    () => false,
  );
  const secondTick = confirmed.then((isItem) =>
    isItem ? wait(TICK_GRACE_MS).then(() => true) : false,
  );

  return {
    timer,
    // `resolveTap` has already run its local tag check by the time it returned
    // its promise above, so this is final.
    tagRead,
    resolution,
    confirmed,
    secondTick,
    item: () => item,
    stepsSeen: () => {
      if (!tagRead) return 0;
      if (confirmedAt === undefined) return 1;
      return now() - confirmedAt >= TICK_GRACE_MS + TICK_SEEN_AFTER_MS ? 2 : 1;
    },
  };
}
