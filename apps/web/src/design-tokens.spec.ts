import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S-1 token migration — the regression guard for it.
 *
 * Story S-1 lifted this app's palette out of ~113 component files and gave
 * every value a semantic name (`packages/config/tailwind-tokens.css`), but
 * most screens were never actually migrated off the raw Tailwind palette;
 * 44 files still wrote `text-slate-500`/`border-slate-200`/`bg-white`
 * directly. That is what made the token file's own stated promise — "adding
 * [dark mode] later is a second `:root` block rather than a sweep through
 * every component" — untrue in practice: a second `:root` block cannot
 * re-theme a hard-coded `bg-white`.
 *
 * This test keeps it true. It is deliberately a source scan rather than a
 * render assertion: the property being protected is "no production file
 * hard-codes a palette value", which no amount of component-level rendering
 * can express, and which a snapshot would only capture incidentally.
 *
 * Scope note: the neutral/`white` families below are the ones S-1 actually
 * tokenized. The semantic status families (`amber`/`red`/`emerald`) are
 * intentionally NOT listed — those are already consumed through
 * `--success-*`/`--warning-*`/`--danger-*` where they belong, and a raw one
 * outside that system is a design question, not a mechanical migration.
 */
const SRC = resolve(process.cwd(), "src");

/** The raw classes S-1 replaced. Each has an exact semantic token — see the
 * `was:` annotations in `packages/config/tailwind-tokens.css`. */
const FORBIDDEN = /\b(?:bg|text|border|ring|divide|fill|stroke|placeholder)-(?:slate-\d{2,3}|white)\b/;

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    // Specs are excluded: a test may legitimately name a raw class while
    // asserting that a component no longer uses it.
    if (/\.(tsx|ts)$/.test(entry) && !entry.includes(".spec.")) {
      out.push(full);
    }
  }
  return out;
}

describe("S-1 design tokens", () => {
  const files = collectSourceFiles(SRC);

  it("finds the production source tree to scan", () => {
    expect(files.length).toBeGreaterThan(150);
  });

  it("uses no raw slate-* or white palette class in any production file", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        // Skip comment lines: several files legitimately record the
        // pre-S-1 class string in a doc comment as historical context
        // (`packages/ui`'s own primitives do exactly this).
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
          return;
        }
        const match = FORBIDDEN.exec(line);
        if (match) {
          offenders.push(`${file.slice(SRC.length + 1)}:${index + 1}  ${match[0]}`);
        }
      });
    }

    expect(offenders, `Use the S-1 semantic tokens instead:\n${offenders.join("\n")}`).toEqual([]);
  });
});
