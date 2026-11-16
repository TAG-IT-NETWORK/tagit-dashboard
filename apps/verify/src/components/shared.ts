/**
 * Plain values the shopper pages share: a marker and the button looks.
 *
 * They live here, in a module that is neither "server" nor "client", ON
 * PURPOSE. ./consumer is a client module, and a value imported from a client
 * module into a server component is not the value: it is a stand-in that only
 * a component can be. Spread onto an element it silently adds nothing (this is
 * how a late line once lost its data-needs-script). Components may come from
 * ./consumer; values must come from here. src/components/__tests__/
 * client-boundary.test.ts checks every import.
 */

/**
 * Spread onto an element that is of no use while scripts are off: a button
 * that opens a form, a list that is loaded by the browser, a part that
 * arrives late and would land out of place. <ConsumerPage> hides these in
 * that case; with scripts on, the attribute does nothing.
 */
export const NEEDS_SCRIPT = { "data-needs-script": "" } as const;

const BUTTON_BASE =
  "flex w-full items-center justify-center rounded-2xl px-4 text-center font-semibold " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * The filled blue button, as a class string, for elements that are not links.
 * One flat colour on purpose (white on it is 4.8:1): its depth comes from the
 * shadow, because a gradient fill is one more thing a contrast-measuring tool
 * cannot see through.
 */
export const PRIMARY_BUTTON = `${BUTTON_BASE} min-h-[56px] bg-brand text-[17px] leading-6 text-white shadow-action hover:bg-brand-strong disabled:opacity-60 disabled:shadow-none`;
export const SECONDARY_BUTTON = `${BUTTON_BASE} min-h-[52px] border border-line-strong bg-white text-base leading-[22px] text-ink shadow-card hover:bg-surface`;
/** For reports: the dark button. */
export const DARK_BUTTON = `${BUTTON_BASE} min-h-[56px] bg-ink text-[17px] leading-6 text-white shadow-card hover:bg-body`;
