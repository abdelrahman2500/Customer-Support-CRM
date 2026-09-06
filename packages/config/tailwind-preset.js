// @ts-check
const defaultTheme = require("tailwindcss/defaultTheme");

/**
 * DS-1a — the shared Tailwind theme customization, extracted from
 * `apps/web/tailwind.config.ts` and `apps/portal/tailwind.config.ts`,
 * which were byte-identical below their own header comments (the
 * portal config's own Story S-1 doc comment explicitly flagged this as
 * temporary: "extracting the shared design layer into a workspace
 * package is Story S-2... The two files must be kept in step until
 * then" — S-2/S-3 shipped `@crm/ui` but never came back to finish this
 * part). `apps/web/src/test/tailwind-content.spec.ts` (and its portal
 * twin) exist specifically because these two configs drifted once
 * before and shipped broken visuals — this file is what keeps the
 * *theme* half of that from happening again.
 *
 * Deliberately NOT consumed via Tailwind's own `presets` config key: a
 * `presets` array REPLACES Tailwind's implicit default preset rather
 * than layering on top of it, so a preset containing only this
 * `theme.extend` shape would silently drop every one of Tailwind's own
 * default colors/spacing/typography scales the moment `presets: [...]`
 * appeared in an app's config — a much larger, harder-to-notice
 * regression than the two-file drift this change fixes. Each app
 * instead imports this object directly and spreads it into its own
 * top-level `theme.extend`, exactly what a plain object literal there
 * already did — a pure relocation, zero change to the resolved theme.
 *
 * `content` and `plugins` deliberately stay in each app's own config:
 * `content` differs in principle per app (today both scan
 * `../../packages/ui/src` too, but an app-specific path would only ever
 * belong in the app's own file), and `apps/web/src/test/tailwind-content.spec.ts`'s
 * own guard imports the app's config and asserts on `config.content`
 * directly — moving it here would break that assertion's premise.
 *
 * The two `globals.css` files (the CSS custom-property token *values*
 * this file's `token()` helper wraps) are also still byte-identical
 * duplicates, hand-kept-in-sync the same way the two `tailwind.config.ts`
 * files were before this change — a JS preset cannot `@import` CSS, so
 * centralizing that half is a separate, later story (DS-1b).
 */

/**
 * Wraps a token from `src/app/globals.css` so Tailwind's opacity modifiers
 * keep working. `bg-ink/40` has to stay expressible (the dialog overlay is
 * exactly that), which is only true if the colour is emitted as
 * `rgb(<channels> / <alpha>)` rather than a flat hex.
 *
 * @param {string} name
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {NonNullable<import("tailwindcss").Config["theme"]>["extend"]} */
const sharedThemeExtend = {
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
   * get wrong. See each app's own `src/lib/fonts.ts`.
   */
  fontFamily: {
    sans: ["var(--font-plex-sans)", "var(--font-plex-arabic)", ...defaultTheme.fontFamily.sans],
  },

  /**
   * A named type scale, additive to Tailwind's own `text-sm`/`text-lg`.
   *
   * The original recon found headings were `text-lg` for page titles and
   * `text-sm` — body size — for section titles, which is why pages read
   * flat. These steps give later stories somewhere to go. Nothing is
   * re-typeset by this file: applying them is a shared `PageHeader`'s
   * job (NAV-2), and `text-sm` remains the body size until then.
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
};

module.exports = sharedThemeExtend;
