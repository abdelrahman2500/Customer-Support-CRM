# Story 198 — PageHeader placement normalization

> CRM UI/UX redesign roadmap item **RD-2.4**. Intake: [`../../stories/page-header-placement-normalization/page-header-placement-normalization/intake.md`](../../stories/page-header-placement-normalization/page-header-placement-normalization/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 2 "RD-2.4"; recon A11Y-04.

---

## Prerequisites

- **Story 197** (`fbd94ab`, RD-2.3): PageHeader with `description`/`actions`/`back`/`meta`/`tabs`, plus the responsive page frame.

---

## Story Goal

Every agent page this Story touches renders exactly one `h1`, as the first thing in `<main>`, through PageHeader's own props. Nothing else on these pages changes: the same strings, controls and behaviour.

**Non-goals:**
- portal pages
- detail-page error states (RD-2.5)
- copy changes
- moving any control other than the ones named here

---

## Design decisions

1. **Out of the Card.**
   - `TicketCategoriesView` and `KbCategoriesView` render `<PageHeader title description />` before the Card. The Card keeps its content.
   - The first child (`QueryStateCard`) loses its `mt-4`, because the Card's own padding now starts it.
   - `BranchDepartmentsView` renders `<PageHeader title={t("myBranch.heading")} />` before both sections, so the `h1` exists in the loading, error and loaded states. `MyBranchSection`'s Card keeps the fields only.
2. **Sibling rows become slots.**
   - Notification history and the audit log become `<PageHeader title actions={<FetchingIndicator …/>} />`. The indicator stays in the title's row, as before, so a page change in flight still adds no height.
   - SLA policies becomes `actions={<Button asChild size="sm">…</Button>}`.
3. **Hosted views (A11Y-04).**
   - PageHeader gains `headingLevel?: 1 | 2` (default 1). Level 2 renders an `<h2 className="text-heading text-ink">` inside a `<div>` root, not a `<header>` landmark, since it is a section of the host page.
   - `BrandingView`, `AiSettingsView` and `BusinessHoursView` take `hosted?: boolean` and pass `headingLevel={hosted ? 2 : 1}`.
   - `SettingsView` renders them with `hosted`. Their standalone routes are unchanged and keep `h1`.

---

## Context — Read These Files First

1. `packages/ui/src/components/page-header.tsx` (+ spec).
2. `apps/web/src/components/ticket-categories/ticket-categories-view.tsx` ~40–102; `kb-categories/kb-categories-view.tsx` ~40–99; `branches/branch-departments-view.tsx` ~45–90 (+ their specs).
3. `notifications/notification-history-view.tsx` ~250–262; `audit-logs/audit-log-view.tsx` ~125–132; `sla-policies/sla-policy-list-view.tsx` ~53–60.
4. `settings/settings-view.tsx` (+ spec); `admin/branding-view.tsx` ~44–52; `admin/ai-settings-view.tsx` ~31–40; `business-hours/business-hours-view.tsx` ~454–482.

---

## Tasks

1. **PageHeader `headingLevel`** (+ spec: level 2 renders an `h2`, not inside a `header` landmark).
2. **The six views** per design decisions 1–2.
3. **The three hosted views:** the `hosted` prop. Settings passes it.
4. **Specs:**
   - per touched view, exactly one `h1` (and for branch, in the loading and error states);
   - Settings has exactly one `h1`, and the hosted views' titles are `h2`;
   - the hosted views standalone still render an `h1`.

   Update existing assertions only where they encoded the old placement.

---

## Verification Steps

1. ui and web tests, typecheck and lint; prettier only on the changed files that were clean at HEAD.
2. Web build.
3. Harness, en/ar at 1280: count `main h1` on `/branches`, `/ticket-categories`, `/kb-categories`, `/notifications`, `/audit-logs`, `/sla-policies`, `/settings` (each tab), `/branding`, `/ai-settings` and `/business-hours`. Expect exactly 1, and the first heading in `<main>` is the `h1`. Also check 0 overflow at 320.
4. Run `git diff --check`; commit path-scoped (a concurrent session has unrelated changes in the worktree); confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] One `h1` at the top of `<main>` on every listed page, in every state.
- [ ] Descriptions via the prop; indicator and button via `actions`.
- [ ] Settings has a single `h1`; the hosted views use `h2`.
- [ ] Specs and harness green; no content change.
