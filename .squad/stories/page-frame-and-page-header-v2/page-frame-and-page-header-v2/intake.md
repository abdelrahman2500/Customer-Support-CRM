> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/page-frame-and-page-header-v2/page-frame-and-page-header-v2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Page frame and PageHeader v2
- **Feature slug (folder under `plans/`):** `page-frame-and-page-header-v2`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-2.3**, global Story **197**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-2-app-shell`, `packages/ui`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
Page frame and PageHeader v2
```

---

## Description

```
Story 197 — RD-2.3 "Page frame and PageHeader v2" of the CRM UI/UX redesign
track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md Phase 2
"RD-2.3").

GOAL
The responsive page gutters (page-x/page-y tokens from Story 179) on both
apps' <main>, and PageHeader slots for back, meta and tabs — additive, with
existing props unchanged.

CONTEXT (verified at HEAD e40545f)
- apps/web workspace-shell.tsx <main> "min-w-0 flex-1 p-6"; portal
  (customer)/layout.tsx <main> "flex-1 p-6". 24px at every width.
- Tokens: --space-page-x/y = 1rem, 1.5rem ≥640px, 2rem ≥1024px; registered
  as spacing `page-x`/`page-y`.
- packages/ui PageHeader: title (single h1, text-title), description,
  actions, className; root <header> is the responsive row; spec pins root
  classes (flex-col sm:flex-row sm:justify-between), shrink-0 actions,
  min-w-0 title block, className merge. 35 callers.
- No page uses negative margins tied to the 24px gutter.

REQUIRED OUTCOME
1. <main> gutters: px-page-x py-page-y in both apps.
2. PageHeader `back` (above the title row), `meta` (under title/
   description, wrapping row), `tabs` (below, full width). Without back and
   tabs the rendered structure is exactly today's.
3. Single-h1 invariant kept (spec); existing props unchanged.
```

---

## Acceptance criteria

```
- [ ] Both apps' <main> use page-x/page-y (16/24/32px) — 320px gains 8px per side.
- [ ] PageHeader back/meta/tabs slots; single h1; existing callers render
      unchanged (existing spec green untouched).
- [ ] Actions still wrap; no physical-direction classes.
- [ ] ui/web/portal tests, typecheck, lint, builds; screenshots 320/1280.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-2.3 depends on RD-1.2 and RD-1.12.
- **Depends on code areas or other stories:** Story 179 (page tokens), Story 189 (BackLink for the back slot).

## Extra notes (optional)

- Moving PageHeader on individual pages is RD-2.4.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/page-header.tsx` (+spec), `apps/web/src/components/workspace/workspace-shell.tsx`, `apps/portal/src/app/[locale]/(customer)/layout.tsx`.

## Out of scope

- Adopting the slots on pages (RD-2.4 / Phase 3+), any backend change.
