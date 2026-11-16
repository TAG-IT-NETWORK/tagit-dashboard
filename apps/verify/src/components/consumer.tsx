"use client";

/**
 * Building blocks of the shopper pages (TAP-T08): the page frame, the verdict,
 * the product block, the rows that open for more details, the closed
 * "Technical details" row and the honest-status footer.
 *
 * Server-safe and synchronous: no hooks, no router, no data access. Pages hand
 * these plain values (and, where a part is interactive, a ready-made element),
 * so every state can be rendered in a unit test exactly as it ships.
 *
 * Two rules live here because every page shares them:
 *   - anything technical goes inside <TechnicalDetails>, which is closed;
 *   - <ConsumerPage> ends with the honest-status sentence, on every state.
 *
 * How a page looks when it arrives (the verdict's entrance, the colour at the
 * top) is in ./stage.module.css. It is all CSS: nothing below needs a script.
 *
 * WHY THIS IS A CLIENT MODULE ("use client"), though nothing in it uses the
 * browser. The page is still rendered to HTML on the server, exactly as
 * before, and still reads and works with scripts off. What changes is what is
 * sent beside the HTML. A server component's output is sent twice, once as
 * HTML and once as a description of every element; that description is cut
 * into pieces by size, and a piece that is ready late is streamed out of
 * place, to be moved by a script. With scripts off it stays where it landed:
 * under the footer. As client components these blocks are described by their
 * few props, so the description is small, arrives whole, and the page weighs
 * less than it did (measured: 87 kB to 74 kB for an owned item, and no piece
 * out of place where there were two).
 *
 * THE RULE THAT COMES WITH IT. Everything handed to a component in this file
 * is sent to the browser, shown or not. Hand these components display values
 * only: never a record, a lookup result or anything that holds an owner's,
 * seller's or reviewer's address. (Reviews are rendered by ./rating-summary,
 * which stays on the server for exactly that reason.)
 */
import type { ReactNode } from "react";

import { COPY, type Tone } from "@/lib/consumer-copy";
import type { TechLink, TechRow } from "@/lib/tap-page";

import { DARK_BUTTON, NEEDS_SCRIPT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./shared";
import styles from "./stage.module.css";

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
  | "lock"
  | "star"
  | "list"
  | "drop"
  | "warning"
  | "flask"
  | "code";

/**
 * `pathLength={1}` makes every shape one unit long whatever its real length,
 * so one rule can draw any of them stroke by stroke (the verdict's mark, see
 * stage.module.css). It changes nothing about how a still icon looks.
 */
const ICON_PATHS: Record<IconName, ReactNode> = {
  check: <path pathLength={1} d="M5 12.5 10 17.5 19 7" strokeLinejoin="round" />,
  alert: <path pathLength={1} d="M12 6v7.5M12 17.5v.5" />,
  cross: <path pathLength={1} d="M7 7l10 10M17 7 7 17" />,
  info: <path pathLength={1} d="M12 11v6M12 7v.5" />,
  // The same "i" inside a circle, for rows (the verdict already supplies the disc).
  about: (
    <>
      <circle pathLength={1} cx="12" cy="12" r="8.5" />
      <path pathLength={1} d="M12 11v5M12 8v.2" />
    </>
  ),
  clock: (
    <>
      <circle pathLength={1} cx="12" cy="12" r="8" />
      <path pathLength={1} d="M12 8v4.5l3 1.5" strokeLinejoin="round" />
    </>
  ),
  shield: (
    <>
      <path
        pathLength={1}
        d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z"
        strokeLinejoin="round"
      />
      <path pathLength={1} d="m9 12 2.2 2.2L15.2 10" strokeLinejoin="round" />
    </>
  ),
  people: (
    <>
      <circle pathLength={1} cx="9" cy="9" r="3" />
      <path
        pathLength={1}
        d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M16 6.5a3 3 0 0 1 0 5.5M17.5 14.8c1.6.7 2.7 2.1 3 4.2"
      />
    </>
  ),
  tag: (
    <>
      <path pathLength={1} d="M8 9c1.8 2 1.8 4 0 6" />
      <path pathLength={1} d="M11.5 6.5c3.3 3.6 3.3 7.4 0 11" />
      <path pathLength={1} d="M15 4c5 5.3 5 10.7 0 16" />
    </>
  ),
  lock: (
    <>
      <rect pathLength={1} x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path pathLength={1} d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  // The marks on the rows that open: reviews, about, how to use, warnings,
  // ingredients, technical details.
  star: (
    <path
      pathLength={1}
      d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.8Z"
      strokeLinejoin="round"
    />
  ),
  list: (
    <>
      <rect pathLength={1} x="5" y="3.5" width="14" height="17" rx="2.6" />
      <path pathLength={1} d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  drop: (
    <path
      pathLength={1}
      d="M12 3.5c3.1 3.7 5.5 6.7 5.5 10a5.5 5.5 0 0 1-11 0c0-3.3 2.4-6.3 5.5-10Z"
      strokeLinejoin="round"
    />
  ),
  warning: (
    <>
      <path pathLength={1} d="M12 4.2 3.6 19h16.8L12 4.2Z" strokeLinejoin="round" />
      <path pathLength={1} d="M12 10.2v4M12 16.6v.2" />
    </>
  ),
  flask: (
    <>
      <path
        pathLength={1}
        d="M9.5 3.5h5M10.5 3.5v5.3l-4.9 8.5a2 2 0 0 0 1.7 3.2h9.4a2 2 0 0 0 1.7-3.2l-4.9-8.5V3.5"
        strokeLinejoin="round"
      />
      <path pathLength={1} d="M8.2 14.5h7.6" />
    </>
  ),
  code: <path pathLength={1} d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4" strokeLinejoin="round" />,
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
 * The small header on every page: the TAG IT mark and what this page is.
 * 56 px tall, always: the verdict's entrance is measured from it (see
 * stage.module.css).
 */
export function PageHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[480px] items-center justify-center gap-2.5 px-4 pb-3 pt-4">
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

/** How a page arrives: after a tap the verdict settles into place; otherwise it appears there. */
export type Entrance = "settle" | "appear";

/**
 * Every shopper page. `timing` (tap pages only) is the tap's step durations,
 * carried as `data-tap-timing` because a server component cannot set a
 * response header — see @/lib/tap-timing.
 *
 * `tone` colours the top of the page to match the verdict. `entrance` and
 * `pace` say how the page arrives; both are for the stylesheet only, and a
 * page given neither simply shows.
 */
export function ConsumerPage({
  children,
  timing,
  tone = "neutral",
  entrance,
  pace,
}: {
  children: ReactNode;
  timing?: string;
  tone?: Tone;
  entrance?: Entrance;
  /** After a tap: how fast the checking frame wraps up (see paceOf in ./checking). */
  pace?: "full" | "brisk";
}) {
  return (
    <div
      className={`${styles.page} flex min-h-screen flex-col overflow-x-clip bg-white text-ink`}
      data-tone={tone}
    >
      <div className={styles.wash} aria-hidden="true" />
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
        className={`${styles.stage} mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-4 pb-6`}
        data-tap-timing={timing || undefined}
        data-entrance={entrance}
        data-pace={pace}
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

/**
 * The one verdict of a page: a seal with its mark, the headline (the page's
 * only <h1>) and one line under it, centred at the top. Announced as a status,
 * so a screen reader says it when it arrives.
 *
 * The seal is decoration; the words carry the verdict. How it arrives is in
 * stage.module.css: after a tap it comes in large where the checking frame's
 * ring was, then settles here.
 */
export function Verdict({
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
    <div role="status" data-verdict={tone} className={styles.hero}>
      <span className={styles.seal} aria-hidden="true">
        <span className={styles.halo} />
        <span className={styles.ring} />
        <span className={styles.ring} />
        <span className={styles.disc}>
          <svg
            viewBox="0 0 24 24"
            width="38"
            height="38"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            className={styles.glyph}
          >
            {ICON_PATHS[icon]}
          </svg>
        </span>
      </span>
      <h1 className={styles.title}>{headline}</h1>
      <p className={styles.line}>{line}.</p>
    </div>
  );
}

/**
 * One block of the page under the verdict. The blocks come up one after the
 * other when the page arrives (`order` 0 first). A block is in the page from
 * the first moment, so what arrives inside it later does not replay that.
 */
export function Group({ order, children }: { order: 0 | 1 | 2 | 3; children: ReactNode }) {
  return (
    <div className={styles.group} data-order={order}>
      {children}
    </div>
  );
}

// ── Product ──────────────────────────────────────────────────────────────────

export function Chips({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-1.5" aria-label={COPY.product.statusLabel}>
      {labels.map((label) => (
        <li
          key={label}
          className="rounded-full border border-line bg-white px-3 py-1 text-[13px] font-semibold leading-[18px] text-body shadow-card"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * What it is, in the order a shopper asks: photo and status chips, the name,
 * one line of basics, what its owners think of it, and the price when it is
 * for sale. Centred. `photo` and `rating` are ready-made elements (the page
 * passes the image component and the rating line), so this block stays free
 * of anything that needs a browser.
 */
export function ProductCard({
  name,
  price,
  priceNote,
  basics,
  rating,
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
  /** The owners' rating, as one line (see <RatingLine>). May arrive late. */
  rating?: ReactNode;
  chips: string[];
  photo?: ReactNode;
}) {
  return (
    <section
      aria-label={COPY.product.sectionLabel}
      className="flex flex-col items-center gap-4 text-center"
    >
      {photo ? (
        <div className={`${styles.photo} relative w-full`}>
          {photo}
          <div className="absolute inset-x-3 top-3">
            <Chips labels={chips} />
          </div>
        </div>
      ) : (
        <Chips labels={chips} />
      )}
      <div className="flex w-full flex-col items-center gap-1">
        <h2 className="min-w-0 max-w-full break-words text-[26px] font-extrabold leading-8 tracking-[-0.02em] [text-wrap:balance]">
          {name}
        </h2>
        {basics.length > 0 && (
          <p className="text-[15px] leading-[22px] text-muted">{basics.join(" · ")}</p>
        )}
        {rating}
        {price && (
          <p className="pt-1.5 text-[26px] font-extrabold leading-8 tracking-[-0.02em]" data-price>
            {price}
          </p>
        )}
        {priceNote}
      </div>
    </section>
  );
}

// ── Lists and sections ───────────────────────────────────────────────────────

/** A part of the page that is always open: a centred title and what is under it. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 pt-2">
      <h2 className="text-center text-lg font-bold leading-6">{title}</h2>
      {children}
    </section>
  );
}

/** A bordered card whose rows are separated by hairlines. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white shadow-card">
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

/**
 * What the item's status means for the reader, in a line or two, centred:
 * "Buying it second-hand?" and what to do about it.
 */
export function Tip({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-white px-5 py-4 text-center shadow-card">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-body">
        <Icon name={icon} />
      </span>
      <p className="text-[15px] font-semibold leading-[22px]">{title}</p>
      {body && <p className="text-sm leading-5 text-body">{body}</p>}
    </div>
  );
}

/**
 * Numbered steps: what to do, in order. `bare` drops the card around them,
 * for steps that already sit inside one (an open row).
 */
export function Steps({
  items,
  tone = "neutral",
  bare = false,
}: {
  items: ReadonlyArray<{ title?: string; body: string }>;
  tone?: "neutral" | "ok";
  bare?: boolean;
}) {
  return (
    <ol
      className={`flex list-none flex-col divide-y divide-line ${bare ? "" : "rounded-2xl border border-line bg-white shadow-card"}`}
    >
      {items.map((item, i) => (
        <li
          key={item.title ?? item.body}
          className={`flex items-start gap-3 ${bare ? "py-3 first:pt-0 last:pb-0" : "p-3.5"}`}
        >
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

/** Label on the left, value on the right. Sits inside an open row. */
export function Facts({ rows }: { rows: ReadonlyArray<readonly [string, string]> }) {
  if (rows.length === 0) return null;
  return (
    <dl className="flex flex-col divide-y divide-line">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
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
 * A piece of the brand's own text. `children` is a string and is rendered as a
 * text node: whatever it contains is read as text, never as markup (REQ-S-10).
 * Long text is set left-aligned, because centred paragraphs are hard to read.
 */
export function BrandText({ children }: { children: string }) {
  return <p className="break-words text-[15px] leading-[22px] text-body">{children}</p>;
}

/** A quiet box for a side note. */
export function Note({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3.5 text-center">
      <p className="text-sm leading-5 text-body [text-wrap:balance]">
        {icon && (
          <Icon name={icon} size={18} className="mr-1.5 inline-block align-[-4px] text-muted" />
        )}
        {children}
      </p>
    </div>
  );
}

// ── Rows that open ───────────────────────────────────────────────────────────

/**
 * A row that opens to show more: the name of what is inside, centred, on a
 * button the full width of the page. Everything a shopper may want but does
 * not need at first glance lives in one of these, closed.
 *
 * A plain <details>: it opens without any script, and its text is in the page
 * either way, so a search of the page finds it. The title is a heading, so
 * the page can still be read by its headings; it is the summary's only child,
 * which is what a <summary> may hold besides plain phrasing.
 *
 * `name` identifies the row (data-row) for tests and checks.
 */
export function Row({
  name,
  icon,
  title,
  needsScript = false,
  children,
}: {
  name: string;
  icon: IconName;
  title: string;
  /** Left out while scripts are off (see NEEDS_SCRIPT). */
  needsScript?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className={`${styles.row} rounded-2xl border border-line bg-white shadow-card`}
      data-row={name}
      {...(name === "technical" ? { "data-technical": "" } : {})}
      {...(needsScript ? NEEDS_SCRIPT : {})}
    >
      <summary className="block cursor-pointer list-none rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <h2 className="relative flex min-h-[56px] items-center justify-center px-14 py-3 text-center text-base font-semibold leading-6">
          <span className="absolute left-3 top-1/2 -mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-body">
            <Icon name={icon} size={18} />
          </span>
          {title}
          <Chevron className="details-chevron absolute right-4 top-1/2 -mt-[9px] text-muted" />
        </h2>
      </summary>
      <div className={`${styles.panel} flex flex-col gap-3 border-t border-line px-4 py-4`}>
        {children}
      </div>
    </details>
  );
}

// ── Actions ──────────────────────────────────────────────────────────────────

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
 * The closed row at the end of the list. The ONLY place a record number, a tag
 * ID, a state code, a network name or a link to the public record may be
 * shown. A plain <details> (see <Row>): it opens without any script.
 */
export function TechnicalDetails({ rows, links }: { rows: TechRow[]; links: TechLink[] }) {
  if (rows.length === 0 && links.length === 0) return null;
  return (
    <Row name="technical" icon="code" title={COPY.technical.title}>
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
          className="inline-flex min-h-[44px] items-center self-start text-[13px] font-semibold leading-[18px] text-brand-link underline underline-offset-2"
        >
          {link.label}
        </a>
      ))}
    </Row>
  );
}
