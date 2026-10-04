> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/table-v2/table-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Table v2
- **Feature slug (folder under `plans/`):** `table-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-1.11**, global Story **188**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-1-design-foundation`, `packages/ui`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Table v2
```

---

## Description

```
Story 188 — RD-1.11 "Table v2" of the CRM UI/UX redesign track (roadmap:
.squad/plans/crm-ui-ux-redesign/00-overview.md §2.10 density, §4.2 Table row,
§6 "RD-1.11"; audit: .squad/plans/crm-ui-ux-redesign/recon.md §2.3 Table row,
TK-07; progress: .squad/plans/crm-ui-ux-redesign/progress.md).

GOAL
Give the shared @crm/ui Table the design language's density, interaction
states and a reusable sortable header, and refresh Pagination — without
changing what any list shows or how it sorts.

CONTEXT (verified in the repository at HEAD 8722e71)
- packages/ui/src/components/table.tsx: Table (wraps <table> in an
  overflow-x-auto div), TableHeader (hidden below sm), TableBody, TableRow
  (below sm a stacked card: `rounded-md border border-rule p-3`; from sm a
  table row with `sm:hover:bg-surface-sunk`), TableHead (`h-10 px-3 … text-xs
  font-medium uppercase tracking-wide text-ink-subtle`), TableCell (`px-3 py-2`,
  with an optional `label` rendered below sm as `text-xs font-medium uppercase
  tracking-wide`).
- The hover tint `surface-sunk` is the page canvas colour, so on lists that
  sit directly on the canvas (the ticket list) the hover is invisible.
- `uppercase tracking-wide` contradicts the design-language Arabic rule (no
  uppercase / letter-spacing on text that may be Arabic; recon VL-11).
- Two lists hand-roll identical sortable headers:
  apps/web/src/components/tickets/ticket-list-view.tsx (createdAt, updatedAt)
  and apps/web/src/components/customers/customer-list-view.tsx (displayName,
  createdAt): <TableHead aria-sort={…}><button type="button"
  className="rounded-sm hover:underline focus-ring" onClick={toggleSort}>
  {label}<SortIndicator direction=…/></button></TableHead>, each with a local
  sortAriaValue helper. SortIndicator lives in
  packages/ui/src/components/sort-indicator.tsx.
- packages/ui/src/components/pagination.tsx: outline sm buttons with chevron
  icons (rtl:rotate-180) and a polite live page indicator (`text-xs`).
- Guard: apps/web/src/test/table-mobile-labels.spec.ts requires every data
  cell in ≥15 table files to pass `label`.

REQUIRED OUTCOME
1. Density: Table accepts `density="compact" | "comfortable"`, shared with its
   head and cells (e.g. via context). `compact` reproduces today's padding
   exactly (head h-10 px-3, cell px-3 py-2) and is the DEFAULT, so every
   existing table renders as today. `comfortable` is the roomier variant
   (roadmap §2.10: ~48px rows, px-4 py-3).
2. Interaction states: row hover uses a tint that is visible on both the
   page canvas and on cards (surface-muted); a row can be marked selected
   (additive prop) with a token tint (accent-surface) exposed to assistive
   tech via aria-selected when the consumer opts in.
3. Typography: header and mobile cell labels lose `uppercase tracking-wide`
   and use the named `label` type step.
4. Mobile card rows use the design-language radius/surface tokens instead of
   `rounded-md`.
5. TableSortHead: a new exported primitive rendering a <th> with the correct
   aria-sort and a <button> that calls back to toggle, showing SortIndicator;
   labels via props/children (translation-free). The two lists above adopt
   it; sort behaviour, URL state and aria-sort values are unchanged.
6. Pagination: visual refresh only (square icon buttons, indicator on the
   type scale with tabular numerals); same props, same behaviour.
```

---

## Acceptance criteria

```
- [ ] `density` prop on Table; compact (default) renders exactly today's head
      and cell padding classes; comfortable renders the roomier set.
- [ ] TableRow hover uses surface-muted; an optional `selected` prop applies
      the accent-surface tint and sets aria-selected; no consumer changes.
- [ ] TableHead and the TableCell mobile label have no `uppercase` or
      `tracking-wide` and use `text-label`.
- [ ] Mobile card rows use token radius (no `rounded-md`).
- [ ] TableSortHead exists and is exported from @crm/ui: aria-sort is
      "ascending" | "descending" | "none" from its `direction` prop; the
      button activates `onSort`; SortIndicator shows the direction.
- [ ] ticket-list-view and customer-list-view use TableSortHead for their 4
      sortable columns; their sort toggling, URL filter state, and aria-sort
      values are unchanged (existing specs pass).
- [ ] Pagination: same API and behaviour; square icon buttons; tabular
      indicator.
- [ ] `apps/web/src/test/table-mobile-labels.spec.ts` passes unchanged.
- [ ] Token-only styling (style guard green); @crm/ui stays translation-free.
- [ ] EN/AR, RTL/LTR, light/dark, 320/768/1280: no new overflow; tables still
      stack to cards below sm; sort buttons keyboard-operable with visible
      focus.
- [ ] ui/web/portal tests, typecheck, lint pass; web and portal builds pass.
- [ ] No backend/API/database/auth/routing change.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-1.11 depends on RD-1.2.
- **Depends on code areas or other stories:** Story 179 (RD-1.2 tokens: `text-label`, radius, `cn`); Story 185 (RD-1.8 Button `icon-sm` size, used by Pagination); Story 187 (RD-1.10 surfaces). Downstream: RD-4.1 (ListToolbar + mobile sort control), RD-4.3/4.4 (list visuals adopt `density`).

## Extra notes (optional)

- Default density MUST be compact so that no existing table changes padding in this Story; screens opt into comfortable later (Phase 4/6).
- Mobile sort control is out of scope (RD-4.1): TableHeader stays hidden below sm.
- Visual evidence: the track's Playwright harness (outside the repo), 320/768/1280 × en/ar × light/dark, on the ticket and customer lists.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/{table,pagination,sort-indicator}.tsx` and specs, `packages/ui/src/index.ts`, `apps/web/src/components/tickets/ticket-list-view.tsx`, `apps/web/src/components/customers/customer-list-view.tsx` (+ their specs).
- Verification: `pnpm --filter @crm/ui test`, `@crm/web test`, `@crm/portal test`, typecheck and lint for all three, `pnpm --filter @crm/web build`, `pnpm --filter @crm/portal build`, `git diff --check`.

## Out of scope

- Mobile sort control, ListToolbar, column changes, bulk selection UI, row click behaviour, opting any screen into `comfortable` density (Phase 4/6).
- Any new dependency; backend, API, database, auth, routing or business-rule changes.
