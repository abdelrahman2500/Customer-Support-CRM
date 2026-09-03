import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";

/**
 * Story S-1 — explicit font ownership for both locales.
 *
 * Before this, neither app loaded a font at all: `next/font` was unused and
 * `globals.css` had no `font-family`, so English rendered in whatever the
 * browser's default sans was and Arabic — a first-class locale here, with
 * full `ar` message coverage and `dir="rtl"` wired through the layout — had
 * no typographic owner whatsoever.
 *
 * Why IBM Plex Sans + IBM Plex Sans Arabic. They are one type family, not
 * two faces bolted together: the Arabic was designed as part of Plex rather
 * than matched to it afterwards, so the two scripts share weight
 * progression, stroke contrast and — critically for a UI where the same
 * component renders in both locales — vertical proportions. Swapping the
 * document direction therefore does not change the density or rhythm of a
 * table row. Plex is also a working UI face rather than a display one:
 * unambiguous digits, a slashed zero, and open apertures at the 12–14px
 * sizes this app actually uses.
 *
 * `next/font/google` downloads and self-hosts both families at build time
 * and emits `font-display: swap` with a size-adjusted local fallback, so
 * there is no request to a font CDN at runtime and no layout shift on first
 * paint. Nothing is added to the dependency list.
 *
 * Only the three weights the app uses are requested (400 body, 500
 * `font-medium`, 600 `font-semibold`) — both families ship as static
 * instances, so an unrequested weight would be a synthesised fake, and
 * every requested one is real bytes over the wire.
 */
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
});

/**
 * Both variables are attached to `<html>` in the locale layout regardless of
 * the active locale — `tailwind.config.ts` lists them as one fallback chain
 * (`--font-plex-sans`, then `--font-plex-arabic`), and per-glyph font
 * fallback picks the right one. That is deliberately not conditional on
 * locale: an Arabic ticket subject in an English workspace, or a Latin
 * customer name in an Arabic one, both have to render in a face that
 * actually covers the script.
 */
export const fontVariables = `${plexSans.variable} ${plexArabic.variable}`;
