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
  /**
   * Story 164 — a form control inside a table cell with no accessible name.
   *
   * `TableCell`'s `label` prop (Story 150) renders a **visible** span that is
   * `sm:hidden`. Below `sm` it stands in for the `<th>` the responsive table
   * hides; at `sm` and up it is `display:none` and therefore absent from the
   * accessibility tree entirely. It was never an accessible name, and a `<th>`
   * does not name a form control nested inside its column either.
   *
   * So six inline-edit inputs — a department name, two category names, a
   * user's email and full name, a role name — were announced as nothing but
   * "edit text" with their current value. The `label` prop sitting right there
   * made them look handled, which is why they survived six accessibility
   * stories.
   *
   * Scoped to controls inside a `TableCell`, which is exactly the pattern this
   * audit found and exactly where the mobile-label convention misleads. It is
   * not a blanket "every input needs `aria-label`" rule: a control named
   * through `<label>`, `<Label>`, `FormField`, `aria-labelledby` or an `id` a
   * label points at is already named, and all of those are accepted here.
   *
   * The portal has no editable table cells today, but renders through the same
   * shared `TableCell`, so the same trap opens the moment it adds one — hence
   * the parallel guard there, matching this file's own convention.
   */
  const CELL_CONTROL = /<(?:Input|Textarea|SelectTrigger)\b/;
  const HAS_ACCESSIBLE_NAME = /aria-label=|aria-labelledby=|\bid=/;
  const NAMING_WRAPPER = /<FormField|<Label\b|<label\b/;

  /** Offending line numbers (1-based) for one file's lines. */
  function findUnnamedCellControls(lines: string[]): number[] {
    const hits: number[] = [];
    let cellDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
        continue;
      }

      if (/<TableCell\b/.test(line)) cellDepth++;
      if (/<\/TableCell>/.test(line)) cellDepth = Math.max(0, cellDepth - 1);
      if (cellDepth === 0) continue;
      if (!CELL_CONTROL.test(line)) continue;

      // The control's whole opening tag, which may span lines.
      let tag = "";
      for (let k = i; k < lines.length && k < i + 16; k++) {
        tag += (lines[k] ?? "") + "\n";
        if (/\/>\s*$/.test(lines[k] ?? "") || /^\s*>\s*$/.test(lines[k] ?? "")) break;
      }
      if (HAS_ACCESSIBLE_NAME.test(tag)) continue;
      if (NAMING_WRAPPER.test(lines.slice(Math.max(0, i - 6), i).join("\n"))) continue;

      hits.push(i + 1);
    }

    return hits;
  }

  it("gives every form control inside a table cell an accessible name", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      for (const line of findUnnamedCellControls(lines)) {
        offenders.push(`${file.slice(SRC.length + 1)}:${line}`);
      }
    }

    expect(
      offenders,
      `TableCell's \`label\` is sm:hidden and names nothing — add aria-label:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("accepts every naming mechanism, and flags only a genuinely unnamed cell control", () => {
    // The defect: the cell's `label` looks like a name but is not one.
    expect(
      findUnnamedCellControls([
        '      <TableCell label={t("columns.name")}>',
        "        <Input",
        '          className="min-w-[10rem]"',
        "          value={nameDraft}",
        "        />",
        "      </TableCell>",
      ]),
    ).toEqual([2]);

    // Named on the control itself.
    for (const attr of [
      'aria-label={t("columns.name")}',
      'aria-labelledby="x"',
      'id="role-name"',
    ]) {
      expect(
        findUnnamedCellControls([
          '      <TableCell label={t("columns.name")}>',
          "        <Input",
          "          " + attr,
          "        />",
          "      </TableCell>",
        ]),
      ).toEqual([]);
    }

    // Named by a wrapper just above.
    expect(
      findUnnamedCellControls([
        "      <TableCell>",
        '        <FormField label={t("columns.name")}>',
        "          <Input value={nameDraft} />",
        "        </FormField>",
        "      </TableCell>",
      ]),
    ).toEqual([]);

    // Outside a table cell this guard says nothing — those controls are named
    // through their own form's label, and are covered by component tests.
    expect(findUnnamedCellControls(["      <Input value={draft} />"])).toEqual([]);

    // A closed cell does not leak into the next sibling.
    expect(
      findUnnamedCellControls([
        "      <TableCell>{role.name}</TableCell>",
        "      <Input value={draft} />",
      ]),
    ).toEqual([]);

    // Commented-out code must not count.
    expect(
      findUnnamedCellControls(["      <TableCell>", "        // <Input value={x} />"]),
    ).toEqual([]);
  });
  /**
   * Story 164 — a ticket enum rendered to a customer as its raw value.
   *
   * The portal home's recent-ticket list rendered `{ticket.status}` inside its
   * `Badge`, so a customer read `IN_PROGRESS`; in Arabic, a bare English
   * SCREAMING_SNAKE token in the middle of an RTL page. Its two siblings —
   * the ticket list and ticket detail — had always rendered the same value
   * through `t("status.<VALUE>")`, and the keys existed in both locales, so
   * this was one screen that missed a convention the app already had.
   *
   * `ticket-filter-messages.spec.ts` did not catch it: that guard asserts the
   * message keys *exist*, not that a component uses them.
   *
   * Narrow on purpose. It matches an enum rendered as a JSX **child** — the
   * only position that becomes visible text — and therefore never flags the
   * legitimate attribute uses right beside it,
   * `variant={ticketStatusBadgeVariant(ticket.status)}` and `value={...}`.
   * It is not a general enum analyser.
   */
  const RAW_ENUM_CHILD = /^\{\s*\w+\.(?:status|priority)\s*\}$/;

  it("renders ticket status and priority through a translation, never as the raw enum", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
          return;
        }
        if (RAW_ENUM_CHILD.test(trimmed)) {
          offenders.push(`${file.slice(SRC.length + 1)}:${index + 1}  ${trimmed}`);
        }
      });
    }

    expect(
      offenders,
      `Render it through t(\`status.\${...}\`) as the ticket list already does:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
