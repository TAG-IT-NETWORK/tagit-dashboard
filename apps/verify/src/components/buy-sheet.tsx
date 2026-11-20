"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { type PayMethod } from "@/lib/buy-methods";
import { COPY } from "@/lib/consumer-copy";

/**
 * "How would you like to pay?" (TAP-T13): the sheet that opens from "Buy now".
 *
 * It lists the ways to pay it is handed, and it is handed only the ways the
 * server offers for the item (see @/lib/buy-methods). It takes no payment
 * itself: choosing a row tells the widget, the sheet closes, and that way's
 * own steps run where the button was. So the sign-in window of the crypto
 * wallet never has to open on top of this one.
 *
 * A native <dialog>, opened with showModal(): the browser keeps the focus
 * inside it, closes it on Escape and gives the focus back to the button that
 * opened it.
 */

const ICONS: Record<PayMethod, ReactNode> = {
  card: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  paypal: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M8 20l2.2-15h5.1c2.6 0 4.2 1.5 3.8 4-.5 3-2.6 4.5-5.6 4.5H10.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  crypto: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14.6 9.4c-.4-.9-1.4-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.2 0-2.2-.5-2.6-1.4M12 6.3V8m0 8v1.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
};

export interface BuySheetBodyProps {
  /** The ways to pay, already in sheet order. */
  methods: readonly PayMethod[];
  /** "Buy now · $23.33" without the "Buy now": the price as the shopper reads it. */
  priceDisplay: string;
  productName: string;
  /** Whether to say that no real money is charged. */
  demo: boolean;
  /** Said above the rows after a choice that could not be taken. */
  notice?: string;
  onChoose: (method: PayMethod) => void;
  onClose: () => void;
}

/** What is inside the sheet. Apart from the <dialog>, so a test can render it as it ships. */
export function BuySheetBody({
  methods,
  priceDisplay,
  productName,
  demo,
  notice,
  onChoose,
  onClose,
}: BuySheetBodyProps) {
  return (
    <div className="flex flex-col gap-4 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="buy-sheet-title" className="text-xl font-bold leading-7 text-ink">
            {COPY.buy.sheetTitle}
          </h2>
          <p className="text-sm leading-5 text-body [overflow-wrap:anywhere]">
            {productName}
            {priceDisplay ? ` · ${priceDisplay}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={COPY.buy.sheetClose}
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {notice && (
        <p role="alert" className="text-sm leading-5 text-bad">
          {notice}
        </p>
      )}

      <ul className="flex flex-col gap-2.5" data-pay-methods>
        {methods.map((method) => (
          <li key={method}>
            <button
              type="button"
              data-method={method}
              onClick={() => onChoose(method)}
              className="flex min-h-[64px] w-full items-center gap-3.5 rounded-2xl border border-line-strong bg-white px-4 py-3 text-left shadow-card hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand">
                {ICONS[method]}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-semibold leading-[22px] text-ink">
                  {COPY.buy.sheetRows[method].title}
                </span>
                <span className="text-[13px] leading-[18px] text-body">
                  {COPY.buy.sheetRows[method].line}
                </span>
              </span>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                aria-hidden="true"
                className="shrink-0 text-muted"
              >
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 text-center text-[13px] leading-[18px] text-muted">
        {demo && <p data-demo-note>{COPY.buy.demoNote}</p>}
        <p>{COPY.buy.sheetFooter}</p>
      </div>
    </div>
  );
}

/**
 * The sheet itself. `open` is the widget's word; the dialog follows it, and
 * tells the widget when the shopper closed it another way (Escape, the
 * backdrop).
 */
export function BuySheet({ open, ...body }: BuySheetBodyProps & { open: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { onClose } = body;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="buy-sheet-title"
      // Escape, or close() above.
      onClose={() => {
        if (open) onClose();
      }}
      // A press on the dimmed page around the sheet: the dialog element itself
      // is the only thing under the pointer there.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 mt-auto w-full max-w-full rounded-t-3xl bg-white p-0 text-left text-ink shadow-card backdrop:bg-black/45 sm:m-auto sm:max-w-[440px] sm:rounded-3xl"
    >
      {open && <BuySheetBody {...body} />}
    </dialog>
  );
}
