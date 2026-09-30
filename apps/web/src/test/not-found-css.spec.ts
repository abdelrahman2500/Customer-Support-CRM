import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Story 177 — the build-artifact half of the CSS/font regression.
 *
 * ## The two failures this protects, both of which shipped silently
 *
 * 1. **No stylesheet at all.** Before this story neither app had a root layout,
 *    and every 404 rendered completely unstyled — the `h1` fell back to
 *    32px/700 regardless of Story 176's `text-title`. Next emits the stylesheet
 *    link for CSS imported by a **layout** in the segment chain, not for CSS
 *    imported by a not-found boundary, so `app/layout.tsx` now owns
 *    `globals.css`.
 * 2. **Stylesheet present, fonts missing.** Fixing (1) exposed a second bug of
 *    the same shape: `next/font` emits its own stylesheet — the one that
 *    *defines* `--font-plex-sans`/`--font-plex-arabic` — and it too is only
 *    emitted for a layout. With the Tailwind bundle linked but not the font
 *    one, `.font-sans`' `var(--font-plex-sans)` was undefined, the whole
 *    `font-family` declaration became invalid, and all four 404s fell back to
 *    Times New Roman. `app/layout.tsx` therefore also side-effect-imports
 *    `@/lib/fonts`.
 *
 * Asserting only that `/layout` carries *some* CSS would catch (1) but not (2):
 * deleting the font import leaves `globals.css` in place, so that weaker check
 * passes while every 404 silently goes serif. This reads the emitted CSS and
 * asserts both halves are actually in it.
 *
 * ## Why these assertions and not others
 *
 * The variable names are the stable contract between `src/lib/fonts.ts` (which
 * defines them) and `@crm/config`'s Tailwind `fontFamily` (which consumes them
 * in `.font-sans`). Bundle filenames, hashes, byte counts and link counts are
 * all generated and deliberately not asserted — Next is free to merge or split
 * bundles, and during this story it did exactly that.
 *
 * **Still necessary rather than sufficient.** The original bug was a manifest
 * entry coexisting with zero emission, so a build artifact can never fully
 * stand in for a real response. The browser verification in this story's plan —
 * computed `font-family` and `h1` size on a live 404 — remains authoritative.
 *
 * Skipped when there is no build output, so a clean checkout does not fail.
 */
const NEXT_DIR = resolve(process.cwd(), ".next");
const MANIFEST = resolve(NEXT_DIR, "app-build-manifest.json");

describe("root layout stylesheet (Story 177)", () => {
  it.skipIf(!existsSync(MANIFEST))(
    "emits one or more stylesheets carrying both the utilities and the font definitions",
    () => {
      const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
        pages: Record<string, string[]>;
      };

      const rootLayout = manifest.pages["/layout"];
      expect(
        rootLayout,
        "No `/layout` entry — the root layout is missing from the build, so the 404 has no stylesheet owner.",
      ).toBeDefined();

      const cssAssets = rootLayout!.filter((asset) => asset.endsWith(".css"));
      expect(
        cssAssets,
        "The root layout carries no CSS asset; every 404 will render unstyled.",
      ).not.toEqual([]);

      // Whatever the bundler produced, read it back and assert on its contents
      // rather than on how many files it happened to split into.
      const css = cssAssets
        .map((asset) => readFileSync(resolve(NEXT_DIR, asset), "utf8"))
        .join("\n");

      expect(css, "`text-title` is missing — the 404 heading would not be 24px/600.").toContain(
        ".text-title",
      );
      expect(
        css,
        "`--font-plex-sans` is never defined. `.font-sans` resolves an undefined variable, which invalidates the whole font-family declaration and drops the 404 to a serif fallback. Check that `app/layout.tsx` still imports `@/lib/fonts`.",
      ).toContain("--font-plex-sans:");
      expect(
        css,
        "`--font-plex-arabic` is never defined, so Arabic on the 404 falls back to a face that may not cover the script.",
      ).toContain("--font-plex-arabic:");
    },
  );
});
