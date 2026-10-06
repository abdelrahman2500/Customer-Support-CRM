/**
 * Story 232 (PR-6.1) regression guards, over both apps' sources (the same
 * source-scanning approach as `table-mobile-labels.spec.ts`).
 *
 * 1. **Every page names itself.** The axe scan of every route found no
 *    `<title>` anywhere (WCAG 2.4.2): assistive technology announces the
 *    document title on navigation, and a tab strip of identical tabs is
 *    unusable. Each `page.tsx` exports `generateMetadata` (`pageTitle`), or
 *    — a client page, which cannot — its route `layout.tsx` does. The locale
 *    root, which only redirects, is the one page without.
 * 2. **Inline errors are announced** (recon A11Y-07). An element painted
 *    with `text-danger-foreground` appears because something failed; without
 *    a role a screen reader never hears it. Each carries `role="alert"`, or
 *    `role="status"` for validation shown while typing.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APPS = {
  web: path.resolve(__dirname, ".."),
  portal: path.resolve(__dirname, "../../../portal/src"),
};

function walk(dir: string, match: (file: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match(entry.name)) out.push(full);
  }
  return out;
}

describe("every page has a document title (Story 232)", () => {
  for (const [app, root] of Object.entries(APPS)) {
    it(`${app}: each page.tsx (or its route layout) exports generateMetadata`, () => {
      const localeRoot = path.join(root, "app", "[locale]");
      const pages = walk(localeRoot, (name) => name === "page.tsx");
      const missing = pages.filter((page) => {
        // The locale root only redirects to the real entry point.
        if (path.dirname(page) === localeRoot) return false;
        if (readFileSync(page, "utf8").includes("export const generateMetadata")) return false;
        const layout = path.join(path.dirname(page), "layout.tsx");
        return !(existsSync(layout) && readFileSync(layout, "utf8").includes("generateMetadata"));
      });
      expect(pages.length).toBeGreaterThan(5);
      expect(missing.map((page) => path.relative(root, page))).toEqual([]);
    });

    it(`${app}: the locale layout sets the title template`, () => {
      const layout = readFileSync(path.join(root, "app", "[locale]", "layout.tsx"), "utf8");
      expect(layout).toContain("template: `%s · ${appName}`");
    });
  }
});

describe("inline errors are announced (Story 232, A11Y-07)", () => {
  for (const [app, root] of Object.entries(APPS)) {
    it(`${app}: every text-danger-foreground <p>/<span>/<div> carries a role`, () => {
      const files = walk(
        path.join(root, "components"),
        (name) => name.endsWith(".tsx") && !name.endsWith(".spec.tsx"),
      );
      const offenders: string[] = [];
      for (const file of files) {
        readFileSync(file, "utf8")
          .split(/\r?\n/)
          .forEach((line, index) => {
            const tag = /<(p|span|div)\b[^>]*className="[^"]*\btext-danger-foreground\b[^"]*"/.exec(
              line,
            );
            if (tag && !/\brole="(alert|status)"/.test(line)) {
              offenders.push(`${path.relative(root, file)}:${index + 1}`);
            }
          });
      }
      expect(offenders).toEqual([]);
    });
  }
});
