import type { Config } from "tailwindcss";
import sharedThemeExtend from "@crm/config/tailwind-preset";

// See docs/architecture/10-i18n-and-rtl.md: prefer logical-property utilities
// (ms-*, me-*, ps-*, pe-*, start-*, end-*) over physical ones (ml-*, mr-*,
// left-*, right-*) in every component so the same markup mirrors correctly
// under `dir="rtl"`. Tailwind ships these logical utilities out of the box —
// no plugin or extra config is required, only the convention.

/**
 * DS-1a — the design-token colours/fonts/type-scale that used to live here
 * directly now live in `@crm/config/tailwind-preset` (a plain object, not a
 * Tailwind `presets` entry — see that file's own doc comment for why),
 * shared with `apps/portal/tailwind.config.ts`. `content` and `plugins`
 * stay local: `apps/web/src/test/tailwind-content.spec.ts` asserts on
 * `config.content` directly, and each app's own content globs belong to
 * that app, not a shared layer.
 */
const config: Config = {
  // `packages/ui` must be scanned too: since S-2 the shared primitives are
  // the only place classes like `bg-accent`, or the Select panel's
  // `max-h-[var(--radix-select-content-available-height)]`, appear. Tailwind
  // only emits utilities it finds in `content`, so without this glob every
  // package-only class is silently dropped from the stylesheet.
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: sharedThemeExtend,
  },
  plugins: [],
};

export default config;
