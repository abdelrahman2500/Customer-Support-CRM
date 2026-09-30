import type { ReactNode } from "react";
import "./globals.css";
// Side-effect import: `next/font` emits its own stylesheet — the one that
// DEFINES `--font-plex-sans`/`--font-plex-arabic` — and, by the same rule that
// applies to `globals.css` above, Next only emits it for a **layout** in the
// chain. Without this the 404 linked the Tailwind bundle but not the font one,
// so `.font-sans`' `var(--font-plex-sans)` was undefined, the whole
// `font-family` declaration became invalid, and the page fell back to Times
// New Roman — measured. The class names themselves are applied by the two
// document owners (`[locale]/layout.tsx` and `app/not-found.tsx`).
import "@/lib/fonts";

/**
 * Story 177 — the root layout, and it owns exactly one thing: the global
 * stylesheet import.
 *
 * ## Why it exists
 *
 * Before this story neither app had a root layout at all — the document lived
 * at `[locale]/layout.tsx`, inside the dynamic segment. That is fine for every
 * real route, but Next serves unmatched URLs from `/_not-found`, which sits
 * OUTSIDE `[locale]`. With no root layout, Next supplied its own bare document
 * and `app/not-found.tsx` rendered a second one inside it (two `<html>`
 * elements), and — measured — the Tailwind bundle was associated with the route
 * in `app-build-manifest.json` yet **no `<link rel="stylesheet">` was ever
 * emitted**. Every 404 in both apps rendered completely unstyled, falling back
 * to UA typography at 32px/700.
 *
 * Moving the CSS import here is what fixes that: Next emits the stylesheet link
 * for CSS imported by a **layout** in the segment chain, not for CSS imported
 * by the not-found boundary itself.
 *
 * ## Why it renders no `<html>`/`<body>`
 *
 * `dir` depends on the active locale, and the locale is only knowable inside
 * `[locale]`. So document ownership deliberately stays with
 * `[locale]/layout.tsx` for real routes and with `app/not-found.tsx` for the
 * 404 — this layout renders its children untouched. That is what keeps exactly
 * one `<html>` and one `<body>` on every path: adding them here would give
 * every route in the app two of each.
 *
 * `[locale]/layout.tsx` keeps its own `globals.css` import; the two resolve to
 * the same stylesheet. The invariant that matters is not how many `<link>`
 * elements a route ends up with — Next is free to merge or split bundles, and
 * it does — but that whatever it emits carries both the Tailwind utilities and
 * the `--font-plex-*` definitions. `src/test/not-found-css.spec.ts` asserts
 * exactly that against the build output.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
