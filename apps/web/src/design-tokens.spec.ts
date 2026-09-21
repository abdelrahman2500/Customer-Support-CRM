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
const FORBIDDEN =
  /\b(?:bg|text|border|ring|divide|fill|stroke|placeholder)-(?:slate-\d{2,3}|white)\b/;

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

  /**
   * Story 139 — the hand-rolled card surface.
   *
   * `packages/ui`'s `Card` has existed since Story S-3 but had zero adoption,
   * while this literal surface string was written out 70 times across the two
   * apps. Every true content surface now renders through `Card`; this keeps
   * them there, so surface chrome has exactly one definition.
   *
   * Deliberately narrow — it matches this one string, so the remaining
   * legitimate users of similar classes are untouched: the centred auth/error
   * page shells (`rounded-lg … p-8 shadow-sm`), the toast, the dropdown
   * panel, and the `bg-surface-sunk` inline notices. None of those is a
   * content card.
   */
  const HAND_ROLLED_SURFACE = /rounded-md border border-rule bg-surface p-4/;

  it("renders content surfaces through the shared Card, not a hand-rolled string", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        // Same comment skip as above: this repo's own doc comments quote the
        // pre-migration class string as historical context.
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
          return;
        }
        if (HAND_ROLLED_SURFACE.test(line)) {
          offenders.push(`${file.slice(SRC.length + 1)}:${index + 1}`);
        }
      });
    }

    expect(offenders, `Use <Card> instead:\n${offenders.join("\n")}`).toEqual([]);
  });

  /**
   * Story 141 — raw inline validation-error colour.
   *
   * `text-red-600` was written 41 times across 23 files for field-level
   * validation text, in five different size/spacing combinations, every one
   * bypassing the `--danger-*` tokens. They now all use
   * `text-danger-foreground` — the token `Alert`, `Badge` and `DropdownMenu`
   * already use for danger text, and a touch darker (red-800) than the
   * `red-600` it replaces, which raises contrast on the light surfaces these
   * errors sit on.
   *
   * Narrow by design: only this one class. The status families stay exempt
   * from `FORBIDDEN` above for the reason that comment gives, and a
   * legitimate inline status colour elsewhere is not caught here.
   */
  const RAW_DANGER_TEXT = /text-red-600/;

  it("colours inline validation errors through the danger token, not a raw palette class", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
          return;
        }
        if (RAW_DANGER_TEXT.test(line)) {
          offenders.push(`${file.slice(SRC.length + 1)}:${index + 1}`);
        }
      });
    }

    expect(offenders, `Use text-danger-foreground instead:\n${offenders.join("\n")}`).toEqual([]);
  });
});
