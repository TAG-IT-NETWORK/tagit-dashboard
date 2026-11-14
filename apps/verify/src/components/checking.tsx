/**
 * The "Checking your product…" frame for the tap pages (TAP-T07).
 *
 *   <Checking>          shown at once, as the page's loading state. A step is
 *                       ticked only once the work behind it has really
 *                       finished: the first arrives ticked, the second is
 *                       streamed in if the record is slow (see TICK_GRACE_MS
 *                       in @/lib/tap-run), the rest tick as the verdict lands.
 *   <CheckingResolved>  the same frame, laid over the finished page for under
 *                       a second: the remaining steps tick, the ring turns into
 *                       the verdict, and the frame fades to show the page. It
 *                       is why the check never just flashes past.
 *   <TapStatusHero>     a verdict header that carries <CheckingResolved>.
 *
 * Server components, CSS and inline SVG only — see checking.module.css. No
 * client JavaScript is involved, so the frame works before the page's scripts
 * load, and with scripts turned off the verdict still shows (see NoScript).
 */
import { Suspense, type ReactNode } from "react";

import { StatusHero } from "./passport";
import styles from "./checking.module.css";

/** Words from the approved copy deck (PRD-TAP-001 §8). */
export const CHECKING_COPY = {
  title: "Checking your product…",
  usual: "This usually takes a second or two.",
  slow: "Still checking. This can take a few seconds.",
  steps: ["Reading the tag", "Confirming it's authentic", "Finding the product record"],
  retry: "Try again",
  reassurance: "No app and no sign-in needed to check a product.",
  opening: "Opening the product page",
} as const;

/**
 * When the frame swaps "This usually takes…" for "Still checking…". The
 * stylesheet's 4s delays are this same number (and 12s for "Try again").
 */
export const STILL_CHECKING_AFTER_MS = 4_000;

/**
 * The frame must be on screen at least this long, so it never flashes past.
 * A check that already took this long has earned a shorter wrap-up.
 */
export const MIN_ON_SCREEN_MS = 600;

export type StepState = "waiting" | "active" | "done";
export type CheckTone = "ok" | "warn" | "bad";
type StepNumber = 1 | 2 | 3;

const STEP_STATUS: Record<StepState, string> = {
  waiting: "not started",
  active: "in progress",
  done: "done",
};

/** One row of the list: a dot that is empty, spinning or ticked, and its label. */
export function CheckStep({
  step,
  state,
  still = false,
}: {
  step: StepNumber;
  state: StepState;
  /** The tick was already on screen: show it without the pop. */
  still?: boolean;
}) {
  return (
    <li
      className={styles.step}
      data-step={step}
      data-state={state}
      data-still={still ? "" : undefined}
    >
      <span className={styles.dot} aria-hidden="true">
        <span className={styles.spin} />
        <span className={styles.tick}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path
              d="M5 12.5 10 17.5 19 7"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
      <span>{CHECKING_COPY.steps[step - 1]}</span>
      <span className={styles.srOnly}>, {STEP_STATUS[state]}</span>
    </li>
  );
}

/**
 * A step that ticks when its work has finished. `when` settles with whether
 * the step really completed; if it did not, the row stays as it was.
 */
async function StepWhen({
  step,
  when,
  otherwise,
}: {
  step: StepNumber;
  when: Promise<boolean>;
  otherwise: StepState;
}) {
  const finished = await when;
  return <CheckStep step={step} state={finished ? "done" : otherwise} />;
}

const RING_TRACK = (
  <svg className={styles.track} viewBox="0 0 132 132" width="132" height="132" fill="none">
    <circle cx="66" cy="66" r="58" strokeWidth="8" />
  </svg>
);

/** The spinner and the tag symbol inside it: what the ring shows while checking. */
const RING_PENDING = (
  <div className={styles.pending}>
    <svg className={styles.arc} viewBox="0 0 132 132" width="132" height="132" fill="none">
      <circle
        cx="66"
        cy="66"
        r="58"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="104 261"
      />
    </svg>
    <svg viewBox="0 0 48 48" width="52" height="52" fill="none">
      <path
        d="M15 17c4 4.4 4 9.6 0 14"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M23 12c7 7.2 7 16.8 0 24"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M31 7c10 10.4 10 23.6 0 34"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

const DISC_GLYPH: Record<CheckTone, ReactNode> = {
  ok: <path d="M5 12.5 10 17.5 19 7" strokeLinejoin="round" />,
  warn: <path d="M12 6v7.5M12 17.5v.5" />,
  bad: <path d="M7 7l10 10M17 7 7 17" />,
};

const FOOT = (
  <p className={styles.foot}>
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <rect
        x="5"
        y="10.5"
        width="14"
        height="9.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
    <span>{CHECKING_COPY.reassurance}</span>
  </p>
);

/**
 * The "Checking…" headline and the line under it. Both phases render exactly
 * this, so nothing moves when the resolved frame takes over from the checking
 * one. `late` starts on the "Still checking" line (the wait already passed 4 s).
 */
function CheckingHead({ heading, late = false }: { heading: boolean; late?: boolean }) {
  const Title = heading ? "h1" : "p";
  return (
    <div className={styles.checkingHead}>
      <Title className={styles.title}>{CHECKING_COPY.title}</Title>
      <div className={styles.wait} data-late={late ? "" : undefined}>
        <p className={styles.usual}>{CHECKING_COPY.usual}</p>
        <p className={styles.slow}>{CHECKING_COPY.slow}</p>
      </div>
    </div>
  );
}

/**
 * With scripts turned off, nothing swaps the finished page in for the frame:
 * the browser receives it, but it stays in the hidden block React streams it
 * into. So without scripts, hide the frame and show those blocks instead.
 */
function NoScript() {
  const css =
    `.${styles.frame},.${styles.step}{display:none!important}` +
    `div[hidden][id^="S:"]{display:block!important}`;
  return (
    <noscript>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </noscript>
  );
}

/**
 * The frame, as the page's loading state.
 *
 * `tagRead` is known when the frame is first sent, so step 1 arrives ticked.
 * `secondTick` ticks step 2 when it settles `true`; step 3 then shows as the
 * one in progress (CSS does that — see the stylesheet). Step 3 itself never
 * ticks here: the moment the record arrives, the verdict replaces the frame.
 * `retryHref` is this same tap again, offered after 12 seconds.
 */
export function Checking({
  tagRead,
  secondTick,
  retryHref,
}: {
  tagRead: boolean;
  secondTick: Promise<boolean>;
  retryHref: string;
}) {
  const second: StepState = tagRead ? "active" : "waiting";
  return (
    <div className={styles.frame} data-tap-frame="checking" data-phase="checking" role="status">
      <NoScript />
      <div className={styles.body}>
        <div className={styles.ring} aria-hidden="true">
          {RING_TRACK}
          {RING_PENDING}
        </div>

        <div className={styles.head}>
          <CheckingHead heading />
        </div>

        <ol className={styles.steps}>
          <CheckStep step={1} state={tagRead ? "done" : "active"} />
          <Suspense fallback={<CheckStep step={2} state={second} />}>
            <StepWhen step={2} when={secondTick} otherwise={second} />
          </Suspense>
          <CheckStep step={3} state="waiting" />
        </ol>

        <p className={styles.retry}>
          <a href={retryHref}>{CHECKING_COPY.retry}</a>
        </p>
      </div>
      {FOOT}
    </div>
  );
}

/** How far the check got, for the frame replayed over the finished page. */
export interface CheckProgress {
  /** Steps that really finished (0–3). */
  done: number;
  /** Of those, how many the shopper already saw tick (they stay still). */
  seen: number;
  /** How long the check took, in milliseconds. Sets the pace of the wrap-up. */
  tookMs: number;
}

/**
 * The frame replayed over the finished page: the steps that finished tick, the
 * ring turns into the verdict, and the whole thing fades to show the page.
 * Decoration only — the page underneath carries the real heading — so it is
 * hidden from assistive technology, and skipped when motion is turned off.
 */
export function CheckingResolved({
  tone,
  title,
  progress,
}: {
  tone: CheckTone;
  title: string;
  progress: CheckProgress;
}) {
  // The check is over: a step that did not finish is not "in progress" any more.
  const stateOf = (step: StepNumber): StepState => (step <= progress.done ? "done" : "waiting");
  return (
    <div
      className={styles.frame}
      data-tap-frame="resolved"
      data-phase="resolved"
      data-tone={tone}
      data-pace={progress.tookMs >= MIN_ON_SCREEN_MS ? "brisk" : "full"}
      aria-hidden="true"
    >
      <div className={styles.body}>
        <div className={styles.ring}>
          {RING_TRACK}
          {RING_PENDING}
          <div className={styles.disc}>
            <svg
              viewBox="0 0 24 24"
              width="64"
              height="64"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              {DISC_GLYPH[tone]}
            </svg>
          </div>
        </div>

        <div className={styles.head}>
          <CheckingHead heading={false} late={progress.tookMs >= STILL_CHECKING_AFTER_MS} />
          <div className={styles.verdictHead}>
            <p className={styles.verdict}>{title}</p>
            {tone === "ok" && progress.done === 3 && (
              <p className={styles.note}>{CHECKING_COPY.opening}</p>
            )}
          </div>
        </div>

        <ol className={styles.steps}>
          {([1, 2, 3] as const).map((step) => (
            <CheckStep key={step} step={step} state={stateOf(step)} still={step <= progress.seen} />
          ))}
        </ol>

        {/* Holds the place the "Try again" link has in the checking frame. */}
        <p className={styles.retry} />
      </div>
      {FOOT}
    </div>
  );
}

/**
 * The verdict header of a tap page: the usual <StatusHero>, with the checking
 * frame resolving into it. Use it only where a tap was actually checked.
 */
export function TapStatusHero({
  progress,
  ...hero
}: {
  tone: CheckTone;
  glyph: string;
  title: string;
  sub: string;
  progress: CheckProgress;
}) {
  return (
    <>
      <CheckingResolved tone={hero.tone} title={hero.title} progress={progress} />
      <StatusHero {...hero} />
    </>
  );
}
