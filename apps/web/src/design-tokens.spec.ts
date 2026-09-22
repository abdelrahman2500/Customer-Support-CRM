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
  /**
   * Story 160 — the hand-rolled section card.
   *
   * Story 154 built `SectionCard` so one primitive owns "a titled section on a
   * surface". Adoption after it was incidental, and 31 sites across the two
   * apps still wrote the composition out by hand:
   *
   *   <Card className="p-surface">
   *     <h2 className="text-sm font-semibold text-ink">{title}</h2>
   *
   * That duplication is how the heading-level drift Story 154 had to fix arose
   * in the first place — when a shape lives in 31 places, a change to it lands
   * in some of them. `SectionCard` renders byte-identical markup (same `Card`,
   * same default `elevation="flat"`, `headingLevel="h2"` by default, and
   * `CardTitle`'s classes are exactly the heading string above), so there is no
   * reason left to write it by hand.
   *
   * Matched as a PAIR, unlike this file's other guards, which are single-line
   * regexes. The anti-pattern is the combination: `p-surface` alone is worn by
   * skeleton placeholders, KPI tiles, `PageHeader` wrappers, `asChild` form and
   * section surfaces and metadata grids — 25 of them here — and none of those is
   * a section card. Matching `Card`, or `p-surface`, on its own would flag every
   * one.
   */
  const SECTION_HEADING = /^<h2\b[^>]*className="text-sm font-semibold text-ink"/;

  /** Offending line numbers (1-based) for one file's lines. */
  function findHandRolledSectionCards(lines: string[]): number[] {
    const hits: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (!/<Card\b/.test(lines[i] ?? "")) continue;

      // The opening tag may span lines; find where it closes.
      let end = -1;
      for (let j = i; j < lines.length && j < i + 12; j++) {
        if (/>\s*$/.test(lines[j] ?? "")) {
          end = j;
          break;
        }
      }
      if (end === -1) continue;
      const tag = lines.slice(i, end + 1).join("\n");
      // A self-closing <Card ... /> has no children to head.
      if (/\/>\s*$/.test(tag)) continue;
      if (!/p-surface/.test(tag)) continue;

      // First meaningful child, skipping blank lines and JSX comments — a
      // comment between the surface and its heading must not hide the pair.
      let inComment = false;
      for (let k = end + 1; k < lines.length; k++) {
        const child = (lines[k] ?? "").trim();
        if (child === "") continue;
        if (inComment) {
          if (child.endsWith("*/}")) inComment = false;
          continue;
        }
        if (child.startsWith("{/*")) {
          if (!child.endsWith("*/}")) inComment = true;
          continue;
        }
        if (SECTION_HEADING.test(child)) hits.push(i + 1);
        break;
      }
    }

    return hits;
  }

  it("renders titled sections through SectionCard, not a hand-rolled Card plus h2", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (const line of findHandRolledSectionCards(lines)) {
        offenders.push(`${file.slice(SRC.length + 1)}:${line}`);
      }
    }

    expect(offenders, `Use <SectionCard title={...}> instead:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });

  it("matches the section-card pair specifically, not either half alone", () => {
    // The pair, including the variations that exist in this tree.
    expect(
      findHandRolledSectionCards([
        '<Card className="p-surface">',
        '<h2 className="text-sm font-semibold text-ink">{t("heading")}</h2>',
      ]),
    ).toEqual([1]);
    expect(
      findHandRolledSectionCards([
        '<Card elevation="raised" className="p-surface">',
        '<h2 className="text-sm font-semibold text-ink">{t("heading")}</h2>',
      ]),
    ).toEqual([1]);
    expect(
      findHandRolledSectionCards([
        "<Card",
        '  className="p-surface"',
        ">",
        "{/* a comment must not hide the pair */}",
        "",
        '<h2 className="text-sm font-semibold text-ink">{t("heading")}</h2>',
      ]),
    ).toEqual([1]);

    // Legitimate `p-surface` Cards that are NOT section cards. Each of these
    // shapes really exists in this tree and must stay allowed.
    expect(
      findHandRolledSectionCards([
        '<Card className="p-surface">',
        '<PageHeader title={t("heading")} />',
      ]),
    ).toEqual([]);
    expect(
      findHandRolledSectionCards([
        '<Card className="p-surface">',
        '<Skeleton className="h-4 w-32" />',
      ]),
    ).toEqual([]);
    expect(
      findHandRolledSectionCards([
        '<Card asChild className="p-surface">',
        "<form onSubmit={handleSubmit}>",
      ]),
    ).toEqual([]);
    expect(
      findHandRolledSectionCards([
        '<Card className="grid grid-cols-1 gap-4 p-surface sm:grid-cols-2">',
        '<Field label={t("detail.status")}>',
      ]),
    ).toEqual([]);

    // A canonical heading that is not inside a `p-surface` surface.
    expect(
      findHandRolledSectionCards([
        "<Card>",
        '<h2 className="text-sm font-semibold text-ink">{t("heading")}</h2>',
      ]),
    ).toEqual([]);
    expect(
      findHandRolledSectionCards([
        "<section>",
        '<h2 className="text-sm font-semibold text-ink">{t("heading")}</h2>',
      ]),
    ).toEqual([]);

    // A self-closing Card has no children to head.
    expect(findHandRolledSectionCards(['<Card className="p-surface" />'])).toEqual([]);
  });
  /**
   * Story 162 — a query loading state with no accessible announcement.
   *
   * `LoadingStatus` (Story 161) is the one definition of what a loading state
   * announces: a labelled `role="status"` with `aria-busy`, over a placeholder
   * kept out of the accessibility tree. Before Stories 161/162, forty-two
   * loading branches across both apps had neither half — nothing was said
   * while a panel loaded, and a bare `Skeleton` (which, unlike `SkeletonText`,
   * is not `aria-hidden`) left empty boxes in the tree with nothing to say.
   *
   * Deliberately narrow. It fires only on the combination of all three:
   *
   *   1. a `*Query.isLoading` / `*Query.isPending` branch opener,
   *   2. a bare `<Skeleton` rendered directly inside that branch, and
   *   3. no `LoadingStatus`, `QueryStateCard` or `role="status"` in it.
   *
   * That keeps the hundred other `Skeleton` usages in this tree out of it —
   * route-level `loading.tsx` fallbacks, the detail-page skeletons, mutation
   * pending states and `SkeletonText`/`SkeletonCard` consumers are all
   * legitimate and none is a query loading branch.
   *
   * Known and accepted false negative: a placeholder rendered through a local
   * component (`reports-view`'s `ReportCardSkeleton`) holds its accessibility
   * one indirection away, which a source scan cannot follow. A guard that
   * tried to would have to resolve components across files, and would start
   * flagging legitimate code. The component-level specs cover those.
   */
  const QUERY_LOADING_BRANCH = /\{\w*Query\.(?:isLoading|isPending) &&/;
  const ACCESSIBLE_LOADING = /LoadingStatus|QueryStateCard|role="status"/;

  /** Offending line numbers (1-based) for one file's lines. */
  function findUnannouncedQueryLoading(lines: string[]): number[] {
    const hits: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
        continue;
      }
      if (!QUERY_LOADING_BRANCH.test(line)) continue;

      // The branch runs until its JSX expression closes at the opener's own
      // indentation, or ends on the opening line when it is a one-liner.
      const indent = line.match(/^\s*/)?.[0] ?? "";
      let end = i;
      for (let k = i; k < lines.length && k < i + 25; k++) {
        end = k;
        if (k === i && /\}$/.test(line.trimEnd())) break;
        if (k > i && (lines[k] === indent + ")}" || (lines[k] ?? "").trimEnd().endsWith("/>}"))) {
          break;
        }
      }

      const branch = lines.slice(i, end + 1).join("\n");
      if (!/<Skeleton\b/.test(branch)) continue;
      if (ACCESSIBLE_LOADING.test(branch)) continue;
      hits.push(i + 1);
    }

    return hits;
  }

  it("announces every query loading state that renders a bare skeleton", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      for (const line of findUnannouncedQueryLoading(lines)) {
        offenders.push(`${file.slice(SRC.length + 1)}:${line}`);
      }
    }

    expect(
      offenders,
      `Wrap the placeholder in <LoadingStatus label={tCommon("loading")}>:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("flags an unannounced query loading branch but not legitimate skeletons", () => {
    // The defect, in both placeholder shapes.
    expect(
      findUnannouncedQueryLoading([
        '        {notesQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}',
      ]),
    ).toEqual([1]);
    expect(
      findUnannouncedQueryLoading([
        "      {tasksQuery.isPending && (",
        '        <div className="flex flex-col gap-2">',
        '          <Skeleton className="h-10 w-full" />',
        "        </div>",
        "      )}",
      ]),
    ).toEqual([1]);

    // Already announced, in each of the three accepted forms.
    expect(
      findUnannouncedQueryLoading([
        "      {tasksQuery.isLoading && (",
        '        <LoadingStatus label={tCommon("loading")} className="flex flex-col gap-2">',
        '          <Skeleton className="h-10 w-full" />',
        "        </LoadingStatus>",
        "      )}",
      ]),
    ).toEqual([]);
    expect(
      findUnannouncedQueryLoading([
        "      {notesQuery.isLoading && (",
        '        <LoadingStatus label={tCommon("loading")} asChild>',
        '          <Skeleton className="mt-2 h-24 w-full" />',
        "        </LoadingStatus>",
        "      )}",
      ]),
    ).toEqual([]);
    expect(
      findUnannouncedQueryLoading([
        "      {rowsQuery.isPending && (",
        '        <div role="status" aria-label="Loading">',
        '          <Skeleton className="h-10 w-full" />',
        "        </div>",
        "      )}",
      ]),
    ).toEqual([]);

    // Legitimate skeletons that are NOT query loading branches.
    expect(findUnannouncedQueryLoading(['      <Skeleton className="h-8 w-1/2" />'])).toEqual([]);
    expect(
      findUnannouncedQueryLoading([
        "      {saveMutation.isPending && (",
        '        <Skeleton className="h-4 w-16" />',
        "      )}",
      ]),
    ).toEqual([]);
    // A query branch whose placeholder is not a bare Skeleton.
    expect(
      findUnannouncedQueryLoading([
        '        {rowsQuery.isLoading && <SkeletonText lines={3} barClassName="h-10" />}',
      ]),
    ).toEqual([]);
    // Commented-out or documented code must not count.
    expect(
      findUnannouncedQueryLoading([
        '      // {notesQuery.isLoading && <Skeleton className="h-4 w-full" />}',
      ]),
    ).toEqual([]);
  });
});
