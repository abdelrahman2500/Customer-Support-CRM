> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/page-header-placement-normalization/page-header-placement-normalization/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** PageHeader placement normalization
- **Feature slug (folder under `plans/`):** `page-header-placement-normalization`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-2.4**, global Story **198**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-2-app-shell`, `apps/web`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
PageHeader placement normalization
```

---

## Description

```
Story 198 — RD-2.4 "PageHeader placement normalization" of the CRM UI/UX
redesign track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md
Phase 2 "RD-2.4"; recon A11Y-04).

GOAL
Every agent page has exactly one h1, at the top of <main>, rendered by
PageHeader with its own description/actions — no PageHeader inside a Card,
no sibling wrapper rows, and no second h1 on Settings.

CONTEXT (verified at HEAD e069476)
- PageHeader inside a Card: branches/branch-departments-view.tsx (~82, and
  only in the loaded state — loading/error render NO h1),
  ticket-categories-view.tsx (~45), kb-categories-view.tsx (~44); the last
  two render their description as a sibling <p>.
- Sibling wrapper rows: notification-history-view.tsx (~251) and
  audit-log-view.tsx (~125) put FetchingIndicator beside the title in a
  flex row; sla-policy-list-view.tsx (~55) puts the create Button beside it.
- Settings (settings-view.tsx) renders its PageHeader h1 and hosts
  BrandingView, AiSettingsView and BusinessHoursView in tabs — each renders
  its own PageHeader h1 (they are also standalone routes /branding,
  /ai-settings, /business-hours) → two h1s (A11Y-04).
- PageHeader (Story 197) has title/description/actions/back/meta/tabs.
- FetchingIndicator renders null while inactive.

REQUIRED OUTCOME
1. PageHeader moved out of the three Cards to the top of the page (branch:
   in every state).
2. description via the prop; FetchingIndicator and the SLA create button via
   `actions` (same row as the title, so nothing shifts).
3. PageHeader `headingLevel` (1 default, 2 for a view hosted under another
   page's h1); the three Settings views take `hosted` and render h2 when
   hosted; standalone routes keep h1.
```

---

## Acceptance criteria

```
- [ ] Every agent page touched has exactly one h1 at the top of <main>
      (view specs), including the branch page while loading/erroring and
      Settings on every tab.
- [ ] No content change (same strings, same controls).
- [ ] web/ui tests, typecheck, lint, build; harness h1-count across pages.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-2.4 depends on RD-2.3.
- **Depends on code areas or other stories:** Story 197 (PageHeader slots).

## Extra notes (optional)

- Error-state h1s on detail pages are RD-2.5.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: the six views above, settings-view + the three hosted views, `packages/ui/src/components/page-header.tsx` (+specs).

## Out of scope

- Portal pages, content changes, error-state redesign (RD-2.5).
