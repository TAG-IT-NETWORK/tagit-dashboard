import type { Config } from "tailwindcss";

/**
 * Colours and type for the shopper pages (TAP-T08, the light design).
 *
 * Contrast, computed (WCAG 2.1): text colours on white / on `surface` —
 * ink 19.2 / 17.7, body 12.0 / 11.1, muted 7.8 / 7.2, brand-link 5.9 / 5.5,
 * ok 5.4 / 5.0, warn 7.4 / 6.9, bad 7.5 / 6.9. Tone text on its own tint:
 * ok 4.9, warn 6.8, bad 6.6. White text on fills: brand 4.8, ok 5.4, warn 7.4,
 * bad 7.5, ink 19.2. `brand` itself is a fill, not a text colour (4.4 on
 * `surface`); links use `brand-link`. `line-field` (3.1 on white) is for
 * borders that have to be seen, such as a text field's.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        // System monospace: Technical details is the only place that uses it,
        // and it is not worth a font download.
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        ink: "#0b0f17",
        body: "#2f3745",
        muted: "#4a5363",
        line: { DEFAULT: "#e3e6eb", strong: "#c9cfd9", field: "#8a94a3" },
        surface: "#f5f6f8",
        brand: { DEFAULT: "#0b72d9", strong: "#0a5fb5", link: "#0b63be" },
        ok: { DEFAULT: "#0b7a45", bg: "#e9f6ef", line: "#bfe3cf" },
        bad: { DEFAULT: "#a3231b", bg: "#fdeeee", line: "#f3c2bf" },
        warn: { DEFAULT: "#7a4b00", bg: "#fff4d6", line: "#f0d48a" },
      },
      boxShadow: {
        // A card that sits just above the page.
        card: "0 1px 2px rgba(11, 15, 23, 0.04), 0 10px 24px -16px rgba(11, 15, 23, 0.22)",
        // The main action: a line of light along its top edge, and a shadow in
        // its own colour under it.
        action:
          "inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 14px 26px -14px rgba(11, 114, 217, 0.85)",
      },
    },
  },
  plugins: [],
};

export default config;
