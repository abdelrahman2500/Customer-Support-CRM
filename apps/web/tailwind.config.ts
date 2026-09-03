import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// See docs/architecture/10-i18n-and-rtl.md: prefer logical-property utilities
// (ms-*, me-*, ps-*, pe-*, start-*, end-*) over physical ones (ml-*, mr-*,
// left-*, right-*) in every component so the same markup mirrors correctly
// under `dir="rtl"`. Tailwind ships these logical utilities out of the box —
// no plugin or extra config is required, only the convention.

/**
 * Story S-1 — wraps a token from `src/app/globals.css` so Tailwind's opacity
 * modifiers keep working. `bg-ink/40` has to stay expressible (the dialog
 * overlay is exactly that), which is only true if the colour is emitted as
 * `rgb(<channels> / <alpha>)` rather than a flat hex.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /**
       * The app's colour API. These are additive — Tailwind's own
       * `slate-*`/`emerald-*` scales still resolve, so the migration can be
       * incremental (recon §14, S-1 → S-3) rather than a single sweep.
       */
      colors: {
        surface: {
          DEFAULT: token("surface"),
          sunk: token("surface-sunk"),
          muted: token("surface-muted"),
        },
        ink: {
          DEFAULT: token("ink"),
          strong: token("ink-strong"),
          muted: token("ink-muted"),
          subtle: token("ink-subtle"),
        },
        rule: {
          DEFAULT: token("rule"),
          strong: token("rule-strong"),
          subtle: token("rule-subtle"),
        },
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          foreground: token("accent-foreground"),
          surface: token("accent-surface"),
        },
        overlay: token("overlay"),
        focus: token("focus"),
        success: {
          subtle: token("success-subtle"),
          surface: token("success-surface"),
          border: token("success-border"),
          solid: token("success-solid"),
          foreground: token("success-foreground"),
        },
        warning: {
          subtle: token("warning-subtle"),
          surface: token("warning-surface"),
          border: token("warning-border"),
          solid: token("warning-solid"),
          foreground: token("warning-foreground"),
        },
        danger: {
          subtle: token("danger-subtle"),
          surface: token("danger-surface"),
          border: token("danger-border"),
          solid: {
            DEFAULT: token("danger-solid"),
            hover: token("danger-solid-hover"),
          },
          foreground: token("danger-foreground"),
        },
        info: {
          subtle: token("info-subtle"),
          surface: token("info-surface"),
          border: token("info-border"),
          solid: token("info-solid"),
          foreground: token("info-foreground"),
        },
      },

      /**
       * Latin first, Arabic second, then the platform stack. Font fallback
       * is resolved per glyph, so this one family list serves both locales
       * with no `[lang]` selector anywhere: IBM Plex Sans has no Arabic
       * coverage, so Arabic characters fall through to IBM Plex Sans Arabic
       * automatically — including Arabic inside an English page and Latin
       * names inside an Arabic one, which a locale-conditional rule would
       * get wrong. See `src/lib/fonts.ts`.
       */
      fontFamily: {
        sans: ["var(--font-plex-sans)", "var(--font-plex-arabic)", ...defaultTheme.fontFamily.sans],
      },

      /**
       * A named type scale, additive to Tailwind's own `text-sm`/`text-lg`.
       *
       * The recon found headings were `text-lg` for page titles and
       * `text-sm` — body size — for section titles, which is why pages read
       * flat. These steps give later stories somewhere to go. Nothing is
       * re-typeset in this story: applying them is the shared `PageHeader`'s
       * job in S-9, and `text-sm` remains the body size until then.
       */
      fontSize: {
        caption: ["0.75rem", { lineHeight: "1.4" }],
        label: ["0.75rem", { lineHeight: "1.3333", letterSpacing: "0.06em", fontWeight: "600" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }],
        body: ["0.875rem", { lineHeight: "1.5714" }],
        subhead: ["1rem", { lineHeight: "1.5", fontWeight: "600" }],
        heading: ["1.125rem", { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "600" }],
        title: ["1.5rem", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
};

export default config;
