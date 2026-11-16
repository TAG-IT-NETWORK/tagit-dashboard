/**
 * Turn a rendered page into what is read out, top to bottom (TAP-T08).
 *
 * The state snapshots store this instead of raw markup: it shows the words,
 * their order and what sits inside the closed drawer, and it does not change
 * when a class name does. Headings are marked, links show where they go, and
 * the drawer's contents are fenced so it is obvious they are not on show.
 *
 * It follows what a screen reader would say: decoration marked aria-hidden is
 * left out and text written only for listeners is kept. In the few places
 * where the two differ (a drawn rating, "≈ €21.11"), the snapshot holds the
 * spoken wording; tests that care about the drawn one look at the markup.
 */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

export function readable(html: string): string {
  return (
    html
      // not read out: scripts, styles, icons, and anything marked as decoration
      .replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/g, "")
      .replace(/<([a-z0-9]+)\b[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<details\b[^>]*>/g, "\n[closed drawer]\n")
      .replace(/<\/details>/g, "\n[end of drawer]\n")
      .replace(/<h1\b[^>]*>/g, "\n# ")
      .replace(/<h2\b[^>]*>/g, "\n## ")
      .replace(/<h3\b[^>]*>/g, "\n### ")
      .replace(/<li\b[^>]*>/g, "\n- ")
      .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, "\n[$2 → $1]\n")
      .replace(/<button\b[^>]*>([\s\S]*?)<\/button>/g, "\n[button: $1]\n")
      .replace(/<img\b[^>]*\balt="([^"]+)"[^>]*>/g, "\n[image: $1]\n")
      // a drawn rating is read out by its label
      .replace(/<span\b[^>]*\brole="img"[^>]*\baria-label="([^"]+)"[^>]*>/g, " ($1) ")
      // inline neighbours are separate words to a reader
      .replace(/<\/(span|time)>\s*<(span|time)\b/g, "</$1> <$2")
      .replace(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g, "\n$1: $2\n")
      .replace(/<\/(p|div|section|header|footer|main|summary|ol|ul|dl|h1|h2|h3|li)>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|#x27|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
  );
}

/**
 * The Technical details drawer, and only that one. A page may hold other
 * closed drawers (the ingredients list, TAP-T09); their text is ordinary page
 * content and has to pass every "never outside the drawer" check.
 */
const TECHNICAL_DRAWER = /<details\b[^>]*\bdata-technical\b[^>]*>[\s\S]*?<\/details>/g;

/** The page with its Technical details drawer and its structured-data block cut out. */
export function outsideDrawer(html: string): string {
  return html
    .replace(TECHNICAL_DRAWER, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
}

/** Only what is inside the Technical details drawer. */
export function insideDrawer(html: string): string {
  return (html.match(TECHNICAL_DRAWER) ?? []).join("\n");
}

/**
 * The rows that open (see <Row> in @/components/consumer). Everything a row
 * holds is in the page, closed; these helpers tell what is in a row from what
 * a shopper sees without opening anything.
 */
const ANY_ROW = /<details\b[^>]*\bdata-row="([^"]+)"[^>]*>[\s\S]*?<\/details>/g;

/** The names of the rows on a page, top to bottom. */
export function rowNames(html: string): string[] {
  return [...html.matchAll(ANY_ROW)].map((m) => m[1]!);
}

/** One row, markup and all, or "" when the page has no such row. */
export function rowOf(html: string, name: string): string {
  return [...html.matchAll(ANY_ROW)].find((m) => m[1] === name)?.[0] ?? "";
}

/** The page with every row cut out: what is on show before anything is opened. */
export function onShow(html: string): string {
  return html.replace(ANY_ROW, "");
}
