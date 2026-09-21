import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S-1 token migration — the regression guard for `apps/portal`.
 *
 * Deliberately parallel to `apps/web/src/design-tokens.spec.ts` rather than
 * shared: each app owns its own Vitest project and its own `src` root, and a
 * guard that has to be imported across package boundaries to protect a
 * package is more fragile than the twenty lines it would save.
 *
 * Story S-1 gave every palette value a semantic name
 * (`packages/config/tailwind-tokens.css`), which this app already imports —
 * `apps/portal/src/app/globals.css` `@import`s that exact file, and
 * `tailwind.config` extends the same `@crm/config/tailwind-preset`. But 16
 * portal files still wrote `text-slate-500`/`border-slate-200`/`bg-white`
 * directly, so the token layer was loaded and then bypassed. That is what
 * made the token file's own promise — "adding [dark mode] later is a second
 * `:root` block rather than a sweep through every component" — untrue for
 * the portal: a second `:root` block cannot re-theme a hard-coded
 * `bg-white`.
 *
 * A source scan rather than a render assertion, for the same reason the web
 * guard is: the property being protected is "no production file hard-codes
 * a palette value", which no component-level render can express and which a
 * snapshot would only capture by accident.
 *
 * Scope note: the semantic status families (`amber`/`red`/`emerald`) are
 * intentionally absent below. Those are already consumed through
 * `--success-*`/`--warning-*`/`--danger-*` where they belong, and a raw one
 * outside that system is a design question rather than a mechanical
 * migration.
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

describe("S-1 design tokens (portal)", () => {
  const files = collectSourceFiles(SRC);

  it("finds the production source tree to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("uses no raw slate-* or white palette class in any production file", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        // Skip comment lines: a file may legitimately record the pre-S-1
        // class string as historical context (`packages/ui`'s own primitives
        // do exactly this).
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
   * Story 135 — the portal's hand-rolled error box.
   *
   * The status families (amber/red/emerald) stay exempt from `FORBIDDEN`
   * above for the reason the doc comment gives: a raw status colour is a
   * design question, not a mechanical rename. But *this specific* pattern is
   * not a design question — it was the portal rendering "an error" as a
   * visibly different object from the one `apps/web` renders for the same
   * meaning, bypassing the `--danger-*` tokens that `Alert`'s `destructive`
   * variant already resolves. Story 135 migrated all 20 occurrences (across
   * 10 files) to `<Alert variant="destructive">`; this keeps them there.
   *
   * Narrow on purpose: it matches the error-box class pair, not every use of
   * red. `ticket-chat-card.tsx`'s delivery-status `text-red-700` is a
   * legitimate inline status colour, is asserted on by that component's own
   * spec, and is deliberately not caught here.
   */
  const RAW_ERROR_BOX = /border-red-200\s+bg-red-50|bg-red-50\s+border-red-200/;

  it("renders errors through the shared Alert, not a hand-rolled red box", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        // Same comment skip as above, and for the same reason — this repo's
        // own plan documents and doc comments quote the pre-migration class
        // string as historical context.
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
          return;
        }
        if (RAW_ERROR_BOX.test(line)) {
          offenders.push(`${file.slice(SRC.length + 1)}:${index + 1}`);
        }
      });
    }

    expect(
      offenders,
      `Use <Alert variant="destructive"> instead:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * Story 139 — the hand-rolled card surface. Same guard as
   * `apps/web/src/design-tokens.spec.ts`'s, kept parallel rather than shared
   * for the reason this file's own header gives.
   *
   * The portal's panels keep their `<section>` landmarks by passing
   * `Card asChild`, so this migration changed styling ownership only, never
   * the page structure.
   */
  const HAND_ROLLED_SURFACE = /rounded-md border border-rule bg-surface p-4/;

  it("renders content surfaces through the shared Card, not a hand-rolled string", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
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
});
