> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/error-state-and-in-shell-error-boundaries/error-state-and-in-shell-error-boundaries/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** ErrorState and in-shell error boundaries
- **Feature slug (folder under `plans/`):** `error-state-and-in-shell-error-boundaries`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-2.5**, global Story **199**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-2-app-shell`, `packages/ui`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
ErrorState and in-shell error boundaries
```

---

## Description

```
Story 199 — RD-2.5 "ErrorState and in-shell error boundaries" of the CRM
UI/UX redesign track (roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md
Phase 2 "RD-2.5"; recon NAV-05, A11Y-03, VL-08).

GOAL
One ErrorState primitive; an agent error boundary that renders inside the
shell (no dead end without navigation); the hand-rolled error/not-found
cards (and the portal's raw <button>) migrated; detail-page load errors get
an h1, a way back and, where it can help, a retry.

CONTEXT (verified at HEAD 54761a3)
- web and portal [locale]/error.tsx, [locale]/not-found.tsx, root
  not-found.tsx: hand-rolled cards (rounded-lg border p-8 shadow-sm); portal
  error.tsx uses a raw <button> with hand-written classes. Specs assert copy,
  link, reset, Sentry, document tags — not classes.
- No web (agent)/error.tsx: a render error drops the whole shell (NAV-05).
- Detail load errors render a bare <Alert> (no h1, no back, no retry):
  web customer-detail-view (~526), web article-detail-view (~132), portal
  ticket-detail-view (~105), portal article-detail-view (~44). Each page's
  success state already has a BackLink (detail.backToList).
- Business hours (~459–476): loading and error states return before the
  PageHeader → no h1; error Alert has no retry.
- Branches (~54): resolved by Story 198 (page h1 in every state; the section
  Alert already retries).
- Messages exist: common.errorBoundary.{title,description,retry},
  common.notFound.{title,description}, common.backLinkLabel,
  <ns>.detail.{notFound,loadError,backToList}.

REQUIRED OUTCOME
1. packages/ui ErrorState: tone (danger | neutral) icon, heading (level 1–3),
   description, actions, back; server-safe (no hooks).
2. web (agent)/error.tsx inside the shell (Sentry + reset), no own <main>.
3. Migrate the six error/not-found files to ErrorState (structure/behaviour
   kept: <main> wrappers, html/body on root not-found).
4. Detail load errors → ErrorState level 1 with BackLink; retry (refetch)
   for non-404 errors only.
5. Business hours: PageHeader in loading/error states; error gets retry.
```

---

## Acceptance criteria

```
- [ ] No error state on these pages lacks an h1; retry calls the existing
      refetch/reset; not-found specs (not-found-css, layout/not-found specs)
      stay green.
- [ ] Agent render errors keep the header and navigation.
- [ ] ui/web/portal tests, typecheck, lint, builds; screenshots of the
      in-shell error and a detail 404 in en/ar.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-2.5 depends on RD-1.10 and RD-1.12.
- **Depends on code areas or other stories:** Story 189 (BackLink), Story 198 (hosted business hours).

## Extra notes (optional)

- Route-level loading skeletons are out of scope.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: `packages/ui/src/components/error-state.tsx` (+spec, index), `apps/web/src/app/[locale]/(agent)/error.tsx` (+spec), the six error/not-found files, four detail views, business-hours-view (+specs).

## Out of scope

- Loading-skeleton redesign, a portal in-shell boundary, any backend change.
