import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static";

import {
  CHECKING_COPY,
  Checking,
  CheckingResolved,
  MIN_ON_SCREEN_MS,
  STILL_CHECKING_AFTER_MS,
  paceOf,
} from "../checking";

/**
 * TAP-T07: the "Checking your product…" frame. These tests pin what the frame
 * says and which steps it shows as done — the part that has to stay honest.
 * How it looks and moves is CSS, checked in a real browser, not here.
 */

const NEVER = new Promise<boolean>(() => {});
const RETRY = "/sun?picc=AA&cmac=BB";

/** The three steps of a rendered frame, as [state, still?] per step. */
function steps(html: string): { state: string; still: boolean }[] {
  return [...html.matchAll(/<li[^>]*data-step="(\d)"[^>]*>/g)]
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map(([tag]) => ({
      state: /data-state="(\w+)"/.exec(tag)![1]!,
      still: /data-still=/.test(tag),
    }));
}
const states = (html: string) => steps(html).map((s) => s.state);

/** Render to the end: every streamed part has arrived and is in place. */
async function renderComplete(node: React.ReactNode): Promise<string> {
  const { prelude } = await prerender(node);
  return new Response(prelude).text();
}

describe("<Checking> — the frame shown while a tap is checked", () => {
  const frame = renderToStaticMarkup(<Checking tagRead secondTick={NEVER} retryHref={RETRY} />);

  it("uses the approved words", () => {
    expect(frame).toContain(`<h1`);
    for (const text of [
      CHECKING_COPY.title,
      CHECKING_COPY.usual,
      CHECKING_COPY.slow,
      CHECKING_COPY.retry,
      CHECKING_COPY.reassurance,
      "Reading the tag",
      // React escapes the apostrophe in text
      "Confirming it&#x27;s authentic",
      "Finding the product record",
    ]) {
      expect(frame).toContain(text);
    }
  });

  it("arrives with the first step ticked, the second in progress and the third waiting", () => {
    expect(states(frame)).toEqual(["done", "active", "waiting"]);
  });

  it("ticks nothing for a tag that failed its check", () => {
    const failed = renderToStaticMarkup(
      <Checking tagRead={false} secondTick={NEVER} retryHref={RETRY} />,
    );
    expect(states(failed)).toEqual(["active", "waiting", "waiting"]);
  });

  it("ticks the second step only when told the work really finished", async () => {
    const finished = await renderComplete(
      <Checking tagRead secondTick={Promise.resolve(true)} retryHref={RETRY} />,
    );
    expect(states(finished)).toEqual(["done", "done", "waiting"]);

    const notFinished = await renderComplete(
      <Checking tagRead secondTick={Promise.resolve(false)} retryHref={RETRY} />,
    );
    expect(states(notFinished)).toEqual(["done", "active", "waiting"]);
  });

  it("never ticks the third step: the verdict replaces the frame instead", async () => {
    const html = await renderComplete(
      <Checking tagRead secondTick={Promise.resolve(true)} retryHref={RETRY} />,
    );
    expect(states(html)[2]).toBe("waiting");
  });

  it("offers the same tap again as the way to retry", () => {
    expect(frame).toContain(`<a href="/sun?picc=AA&amp;cmac=BB">${CHECKING_COPY.retry}</a>`);
  });

  it("is announced as a status, and tells assistive technology each step's state", () => {
    expect(frame).toMatch(/data-tap-frame="checking"[^>]*role="status"/);
    expect(frame).toContain(", done");
    expect(frame).toContain(", in progress");
    expect(frame).toContain(", not started");
  });

  it("with scripts off, hides itself and shows the streamed page instead", () => {
    const rule = /<noscript><style>(.*?)<\/style><\/noscript>/.exec(frame)?.[1] ?? "";
    expect(rule).toContain("display:none!important");
    expect(rule).toContain('div[hidden][id^="S:"]{display:block!important}');
  });
});

describe("<CheckingResolved> — the frame replayed over the finished page", () => {
  const render = (props: Partial<Parameters<typeof CheckingResolved>[0]> = {}) =>
    renderToStaticMarkup(
      <CheckingResolved opening progress={{ done: 3, seen: 1, tookMs: 300 }} {...props} />,
    );

  it("ticks every finished step and says the product page is opening", () => {
    const html = render();
    expect(states(html)).toEqual(["done", "done", "done"]);
    expect(html).toContain(CHECKING_COPY.opening);
  });

  it("draws no verdict of its own: the page's verdict arrives over it", () => {
    // One verdict, drawn once. A second copy here could come to say something
    // else than the page under it.
    for (const html of [render(), render({ opening: false })]) {
      expect(html).not.toMatch(/Authentic|verify|Reported|Retired|expired/);
      expect(html).not.toContain("data-tone");
      expect(html).not.toContain("data-verdict");
    }
  });

  it("keeps still the ticks the shopper already saw, and replays the rest", () => {
    expect(steps(render()).map((s) => s.still)).toEqual([true, false, false]);
    expect(
      steps(render({ progress: { done: 3, seen: 2, tookMs: 2_000 } })).map((s) => s.still),
    ).toEqual([true, true, false]);
  });

  it("ticks nothing it cannot stand behind when the check failed", () => {
    const html = render({ opening: false, progress: { done: 0, seen: 0, tookMs: 2 } });
    expect(states(html)).toEqual(["waiting", "waiting", "waiting"]);
    expect(html).not.toContain(CHECKING_COPY.opening);
  });

  it("shows only the steps that finished for a genuine tag with no product", () => {
    const html = render({ opening: false, progress: { done: 1, seen: 1, tookMs: 150 } });
    expect(states(html)).toEqual(["done", "waiting", "waiting"]);
    expect(html).not.toContain(CHECKING_COPY.opening);
  });

  it("says a page is opening only when every step finished, whatever it is told", () => {
    for (const done of [0, 1, 2]) {
      expect(render({ opening: true, progress: { done, seen: 0, tookMs: 300 } })).not.toContain(
        CHECKING_COPY.opening,
      );
    }
    expect(render({ opening: false })).not.toContain(CHECKING_COPY.opening);
  });

  it("stays on the 'Still checking' line when the wait had already passed it", () => {
    expect(render()).not.toContain("data-late");
    expect(render({ progress: { done: 3, seen: 2, tookMs: STILL_CHECKING_AFTER_MS } })).toContain(
      "data-late",
    );
  });

  it("is decoration: hidden from assistive technology, with no heading of its own", () => {
    const html = render();
    expect(html).toMatch(/data-tap-frame="resolved"[^>]*aria-hidden="true"/);
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<a ");
  });
});

describe("the pace of the wrap-up", () => {
  it("is brisk once the check has already taken the minimum time on screen", () => {
    expect(paceOf(0)).toBe("full");
    expect(paceOf(MIN_ON_SCREEN_MS - 1)).toBe("full");
    expect(paceOf(MIN_ON_SCREEN_MS)).toBe("brisk");
    expect(paceOf(STILL_CHECKING_AFTER_MS)).toBe("brisk");
  });
});
