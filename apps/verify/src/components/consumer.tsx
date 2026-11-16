/**
 * Building blocks of the shopper pages (TAP-T08): the page frame, the verdict
 * banner, the product card, lists, the closed "Technical details" drawer and
 * the honest-status footer.
 *
 * Server-safe and synchronous: no hooks, no router, no data access. Pages hand
 * these plain values (and, where a part is interactive, a ready-made element),
 * so every state can be rendered in a unit test exactly as it ships.
 *
 * Two rules live here because every page shares them:
 *   - anything technical goes inside <TechnicalDetails>, which is closed;
 *   - <ConsumerPage> ends with the honest-status sentence, on every state.
 */
import type { ReactNode } from "react";

import { COPY, type Tone } from "@/lib/consumer-copy";
import type { TechLink, TechRow } from "@/lib/tap-page";

export type { TechLink, TechRow };

// ── Icons (inline, decorative) ───────────────────────────────────────────────

export type IconName =
  | "check"
  | "alert"
  | "cross"
  | "info"
  | "about"
  | "clock"
  | "shield"
  | "people"
  | "tag"
  | "lock";

const ICON_PATHS: Record<IconName, ReactNode> = {
  check: <path d="M5 12.5 10 17.5 19 7" strokeLinejoin="round" />,
  alert: <path d="M12 6v7.5M12 17.5v.5" />,
  cross: <path d="M7 7l10 10M17 7 7 17" />,
  info: <path d="M12 11v6M12 7v.5" />,
  // The same "i" inside a circle, for rows (a banner already supplies the disc).
  about: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8v.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" strokeLinejoin="round" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" strokeLinejoin="round" />
      <path d="m9 12 2.2 2.2L15.2 10" strokeLinejoin="round" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M16 6.5a3 3 0 0 1 0 5.5M17.5 14.8c1.6.7 2.7 2.1 3 4.2" />
    </>
  ),
  tag: (
    <>
      <path d="M8 9c1.8 2 1.8 4 0 6" />
      <path d="M11.5 6.5c3.3 3.6 3.3 7.4 0 11" />
      <path d="M15 4c5 5.3 5 10.7 0 16" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
      className={className ? `flex-none ${className}` : "flex-none"}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ? `flex-none ${className}` : "flex-none"}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ── Page frame ───────────────────────────────────────────────────────────────

/**
 * Spread onto an element that is of no use while scripts are off: a button
 * that opens a form, a list that is loaded by the browser, a section that
 * arrives late and would land below the footer. <ConsumerPage> hides these in
 * that case; with scripts on, the attribute does nothing.
 */
export const NEEDS_SCRIPT = { "data-needs-script": "" } as const;

/** The small header on every page: the TAG IT mark and what this page is. */
export function PageHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[480px] items-center gap-2.5 px-4 pb-3 pt-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 6 kB static mark; the image pipeline would add nothing */}
      <img
        src="/tagit-mark.svg"
        width={28}
        height={28}
        alt=""
        className="h-7 w-7 rounded-[7px] border border-line"
      />
      <span className="text-sm font-semibold leading-5 text-body">{COPY.pageLabel}</span>
    </header>
  );
}

/**
 * Every shopper page. `timing` (tap pages only) is the tap's step durations,
 * carried as `data-tap-timing` because a server component cannot set a
 * response header — see @/lib/tap-timing.
 */
export function ConsumerPage({ children, timing }: { children: ReactNode; timing?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      {/* With scripts off, the parts that only work with scripts are left out
          rather than shown dead (see NEEDS_SCRIPT). The verdict, the product
          and Technical details need no script at all. */}
      <noscript>
        <style
          dangerouslySetInnerHTML={{ __html: "[data-needs-script]{display:none!important}" }}
        />
      </noscript>
      <PageHeader />
      <main
        className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-4 pb-6"
        data-tap-timing={timing || undefined}
      >
        {children}
      </main>
      <footer className="mx-auto w-full max-w-[480px] px-6 pb-8 pt-2 text-center">
        <p className="text-[13px] leading-[18px] text-muted">{COPY.honestStatus}</p>
        <p className="mt-2.5 text-[13px] leading-[18px] text-muted">
          <a
            href="https://www.tagit.network"
            className="inline-flex min-h-[44px] items-center px-2 underline underline-offset-2"
          >
            {COPY.footerBrand}
          </a>
        </p>
      </footer>
    </div>
  );
}

// ── Verdict ──────────────────────────────────────────────────────────────────

const TONE_BOX: Record<Tone, string> = {
  ok: "border-ok-line bg-ok-bg",
  warn: "border-warn-line bg-warn-bg",
  bad: "border-bad-line bg-bad-bg",
  neutral: "border-line bg-surface",
};
const TONE_DISC: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  neutral: "bg-ink",
};
const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  neutral: "text-ink",
};

/**
 * The one verdict of a page: a mark, the headline (the page's only <h1>) and
 * one line under it. Announced as a status, so a screen reader says it when it
 * arrives.
 */
export function VerdictBanner({
  tone,
  icon,
  headline,
  line,
}: {
  tone: Tone;
  icon: IconName;
  headline: string;
  line: string;
}) {
  return (
    <div
      role="status"
      data-verdict={tone}
      className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 ${TONE_BOX[tone]}`}
    >
      <span
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-white ${TONE_DISC[tone]}`}
      >
        <Icon name={icon} size={24} strokeWidth={2.6} />
      </span>
      <div className="min-w-0">
        <h1 className={`text-balance text-[22px] font-bold leading-7 ${TONE_TEXT[tone]}`}>
          {headline}
        </h1>
        <p className="text-sm leading-5 text-body">{line}.</p>
      </div>
    </div>
  );
}

// ── Product ──────────────────────────────────────────────────────────────────

export function Chips({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={COPY.product.statusLabel}>
      {labels.map((label) => (
        <li
          key={label}
          className="rounded-full border border-line bg-white px-2.5 py-1 text-[13px] font-semibold leading-[18px] text-body"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * What it is: photo, status chips, name, price and one line of basics. `photo`
 * is a ready-made element (the page passes the image component), so this block
 * stays free of anything that needs a browser.
 */
export function ProductCard({
  name,
  price,
  priceNote,
  basics,
  chips,
  photo,
}: {
  name: string;
  /** Shown only when the server reports a live listing. */
  price?: string;
  /** e.g. the approximate price in another currency. */
  priceNote?: ReactNode;
  /** Brand, origin and the like, already in display form. */
  basics: string[];
  chips: string[];
  photo?: ReactNode;
}) {
  return (
    <section aria-label={COPY.product.sectionLabel} className="flex flex-col gap-4">
      {photo ? (
        <div className="relative">
          {photo}
          <div className="absolute left-3 top-3">
            <Chips labels={chips} />
          </div>
        </div>
      ) : (
        <Chips labels={chips} />
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 break-words text-[22px] font-bold leading-7">{name}</h2>
          {price && (
            <p className="flex-none text-[22px] font-bold leading-7" data-price>
              {price}
            </p>
          )}
        </div>
        {basics.length > 0 && <p className="text-sm leading-5 text-muted">{basics.join(" · ")}</p>}
        {priceNote}
      </div>
    </section>
  );
}

// ── Lists and sections ───────────────────────────────────────────────────────

export function Section({
  id,
  title,
  needsScript = false,
  children,
}: {
  id?: string;
  title: string;
  /** Left out while scripts are off (see NEEDS_SCRIPT). */
  needsScript?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-4 flex-col gap-3 pt-4"
      {...(needsScript ? NEEDS_SCRIPT : {})}
    >
      <h2 className="text-lg font-bold leading-6">{title}</h2>
      {children}
    </section>
  );
}

/** A bordered card whose rows are separated by hairlines. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-line rounded-2xl border border-line">
      {children}
    </div>
  );
}

/** A row with an icon, a line of text and, optionally, a line under it. */
export function InfoRow({ icon, title, body }: { icon: IconName; title?: string; body?: string }) {
  return (
    <div className="flex items-start gap-3 p-3.5">
      <Icon name={icon} className="mt-0.5 text-muted" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="text-[15px] font-semibold leading-[22px]">{title}</p>}
        {body && <p className="text-sm leading-5 text-body">{body}</p>}
      </div>
    </div>
  );
}

/** A row that is a link: the whole row is the target, at least 48 px tall. */
export function LinkRow({
  href,
  icon,
  label,
  external = false,
}: {
  href: string;
  icon?: IconName;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex min-h-[52px] items-center gap-3 px-3.5 text-[15px] font-semibold leading-[22px] text-brand-link underline-offset-2 hover:underline"
    >
      {icon && <Icon name={icon} />}
      <span className="min-w-0 flex-1">{label}</span>
      <Chevron className="-rotate-90" />
    </a>
  );
}

/** Numbered steps: what to do, in order. */
export function Steps({
  items,
  tone = "neutral",
}: {
  items: ReadonlyArray<{ title?: string; body: string }>;
  tone?: "neutral" | "ok";
}) {
  return (
    <ol className="flex list-none flex-col divide-y divide-line rounded-2xl border border-line">
      {items.map((item, i) => (
        <li key={item.title ?? item.body} className="flex items-start gap-3 p-3.5">
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold leading-none text-white ${tone === "ok" ? "bg-ok" : "bg-ink"}`}
          >
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            {item.title && <p className="text-[15px] font-semibold leading-[22px]">{item.title}</p>}
            <p className={`text-sm leading-5 ${item.title ? "text-muted" : "text-body"}`}>
              {item.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Label on the left, value on the right. */
export function Facts({ rows }: { rows: ReadonlyArray<readonly [string, string]> }) {
  if (rows.length === 0) return null;
  return (
    <dl className="flex flex-col divide-y divide-line rounded-2xl border border-line">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-sm leading-5 text-muted">{label}</dt>
          <dd className="min-w-0 break-words text-right text-sm font-semibold leading-5">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A short piece of the brand's own text under a small heading, shown in full.
 * `children` is a string and is rendered as a text node: whatever it contains
 * is read as text, never as markup (REQ-S-10).
 */
export function TextBlock({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-[15px] font-semibold leading-[22px]">{title}</h3>
      <p className="break-words text-[15px] leading-[22px] text-body">{children}</p>
    </div>
  );
}

/**
 * A closed drawer for a long piece of the brand's own text (an ingredients
 * list). A plain <details>: it opens without any script, and the text is in
 * the page either way, so it is found by a search of the page. Text node
 * only, as in <TextBlock>.
 */
export function TextDrawer({ title, children }: { title: string; children: string }) {
  return (
    <details className="rounded-2xl border border-line" data-text-drawer>
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-[15px] font-semibold leading-[22px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        {title}
        <Chevron className="details-chevron text-muted" />
      </summary>
      <p className="break-words px-4 pb-3.5 text-sm leading-5 text-body">{children}</p>
    </details>
  );
}

/** A quiet box for a side note. */
export function Note({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface p-3.5">
      {icon && <Icon name={icon} className="mt-0.5 text-muted" />}
      <p className="text-sm leading-5 text-body">{children}</p>
    </div>
  );
}

// ── Actions ──────────────────────────────────────────────────────────────────

const BUTTON_BASE =
  "flex w-full items-center justify-center rounded-[14px] px-4 text-center font-semibold " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** The filled blue button, as a class string, for elements that are not links. */
export const PRIMARY_BUTTON = `${BUTTON_BASE} min-h-[52px] bg-brand text-[17px] leading-6 text-white hover:bg-brand-strong disabled:opacity-60`;
export const SECONDARY_BUTTON = `${BUTTON_BASE} min-h-[48px] border border-line-strong bg-white text-base leading-[22px] text-ink hover:bg-surface`;
const DARK_BUTTON = `${BUTTON_BASE} min-h-[52px] bg-ink text-[17px] leading-6 text-white hover:bg-body`;

/** One action, as a link. `primary` is blue, `dark` is for reports, the rest outlined. */
export function ActionLink({
  href,
  kind = "secondary",
  children,
}: {
  href: string;
  kind?: "primary" | "secondary" | "dark";
  children: ReactNode;
}) {
  const className =
    kind === "primary" ? PRIMARY_BUTTON : kind === "dark" ? DARK_BUTTON : SECONDARY_BUTTON;
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

// ── Technical details ────────────────────────────────────────────────────────

/**
 * The closed drawer at the bottom. The ONLY place a record number, a tag ID, a
 * state code, a network name or a link to the public record may be shown. A
 * plain <details>: it opens without any script.
 */
export function TechnicalDetails({ rows, links }: { rows: TechRow[]; links: TechLink[] }) {
  if (rows.length === 0 && links.length === 0) return null;
  return (
    <details className="rounded-2xl border border-line" data-technical>
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-[15px] font-semibold leading-[22px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        {COPY.technical.title}
        <Chevron className="details-chevron text-muted" />
      </summary>
      <div className="flex flex-col gap-2.5 px-4 pb-3.5">
        {rows.length > 0 && (
          <dl className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-[13px] leading-[18px] text-muted">{row.label}</dt>
                {/* A single code (a number, an ID) is set in mono and may break
                    anywhere; a phrase is set as text and breaks between words. */}
                <dd
                  className={`min-w-0 text-right text-[13px] leading-[18px] text-body [overflow-wrap:anywhere] ${row.value.includes(" ") ? "" : "font-mono"}`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex min-h-[44px] items-center text-[13px] font-semibold leading-[18px] text-brand-link underline underline-offset-2"
          >
            {link.label}
          </a>
        ))}
      </div>
    </details>
  );
}
