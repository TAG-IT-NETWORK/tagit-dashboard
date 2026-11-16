/**
 * Turn a rendered page into what a person reads, top to bottom (TAP-T08).
 *
 * The state snapshots store this instead of raw markup: it shows the words,
 * their order and what sits inside the closed drawer, and it does not change
 * when a class name does. Headings are marked, links show where they go, and
 * the drawer's contents are fenced so it is obvious they are not on show.
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
      // not for readers: scripts, styles, icons, and anything hidden from everyone
      .replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/g, "")
      .replace(/<([a-z0-9]+)\b[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<details\b[^>]*>/g, "\n[closed drawer]\n")
      .replace(/<\/details>/g, "\n[end of drawer]\n")
      .replace(/<h1\b[^>]*>/g, "\n# ")
      .replace(/<h2\b[^>]*>/g, "\n## ")
      .replace(/<li\b[^>]*>/g, "\n- ")
      .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, "\n[$2 → $1]\n")
      .replace(/<button\b[^>]*>([\s\S]*?)<\/button>/g, "\n[button: $1]\n")
      .replace(/<img\b[^>]*\balt="([^"]+)"[^>]*>/g, "\n[image: $1]\n")
      // a drawn rating is read out by its label
      .replace(/<span\b[^>]*\brole="img"[^>]*\baria-label="([^"]+)"[^>]*>/g, " ($1) ")
      // inline neighbours are separate words to a reader
      .replace(/<\/(span|time)>\s*<(span|time)\b/g, "</$1> <$2")
      .replace(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g, "\n$1: $2\n")
      .replace(/<\/(p|div|section|header|footer|main|summary|ol|ul|dl|h1|h2|li)>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|#x27|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
  );
}

/** The page with its closed drawer and its structured-data block cut out. */
export function outsideDrawer(html: string): string {
  return html
    .replace(/<details\b[\s\S]*?<\/details>/g, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
}

/** Only what is inside the closed drawer. */
export function insideDrawer(html: string): string {
  return (html.match(/<details\b[\s\S]*?<\/details>/g) ?? []).join("\n");
}
