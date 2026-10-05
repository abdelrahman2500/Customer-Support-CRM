> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/primitive-kit-v2/primitive-kit-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Primitive kit v2
- **Feature slug (folder under `plans/`):** `primitive-kit-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM product redesign roadmap item **PR-1.2**, global Story **211**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-product-redesign`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Primitive kit v2
```

---

## Description

```
Story 211 — PR-1.2 of the CRM product redesign (roadmap Phase 1; absorbs
the primitive parts of RD-4.1 ListToolbar, RD-4.6 StatCard, RD-5.7 Switch
and RD-6.1 Sheet).

GOAL
Every building block the redesigned screens need exists, accessible and
RTL-correct, before any screen is rebuilt: Sheet, Switch,
SegmentedControl, ListToolbar, StatCard, the chart primitives and the
Board/BoardColumn layout.

CONTEXT
- Dialog (Radix) and the overlay classes exist (Story 187); motion tokens
  and keyframes live in the preset (no animation plugin).
- Charts (BarChart, DonutGauge, RatingBar) are dependency-free in
  apps/web reporting/report-charts.tsx (RM-08); the dashboard hand-rolls a
  StatTile.
- No switch, radio-group, toolbar or board primitive exists; no Radix
  switch is installed (no new dependency wanted).
- Story 210 added the recipes, chrome and viz tokens.

REQUIRED OUTCOME
1. Sheet: Radix-dialog side panel from the inline end (mirrors in RTL via
   --sheet-from), start side for drawers, sizes, header/body/footer.
2. Switch: role="switch" button, aria-checked, logical thumb movement.
3. SegmentedControl: radio group, single tab stop, dir-aware arrows,
   Home/End, counts and tone dots.
4. ListToolbar: search committing on Enter/blur with clear, inline filters
   that collapse into a "Filters (n)" Sheet below sm, polite summary,
   clear-all when filtered, actions.
5. StatCard: display number, label, hint, tone edge, asChild link.
6. Charts moved to @crm/ui (+ DistributionBar); web re-exports them.
7. Board / BoardColumn layout (region, horizontal scroll with snap, status
   spine, header with count, scrolling body, collapsed rail).
```

---

## Acceptance criteria

```
- [ ] Each primitive has specs for its ARIA pattern and keyboard paths
      (RTL arrows where relevant); translation-free (labels are props).
- [ ] Charts' existing web specs pass unchanged through the re-export.
- [ ] ui/web/portal tests, typecheck, lint, web build green.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none.
- **Depends on code areas or other stories:** Stories 187, 210.

## Extra notes (optional)

- Consumers arrive in Phases 2–5 (board PR-3.1, dashboard PR-3.6, admin PR-4.5/4.6, portal PR-5.3).

## Technical hints (optional)

- Files: `packages/ui/src/components/{sheet,switch,segmented-control,list-toolbar,stat-card,charts,board}.tsx` (+specs), `packages/ui/src/index.ts`, `packages/config/tailwind-preset.js` (sheet keyframes), `apps/web/src/components/reporting/report-charts.tsx`.

## Out of scope

- Screen adoption (later Stories); drag-and-drop logic (PR-3.2); new dependencies.
