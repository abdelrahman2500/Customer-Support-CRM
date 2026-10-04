# Story 191 — Ticket status and priority presentation

> CRM UI/UX redesign roadmap item **RD-1.14**. Intake: [`../../stories/ticket-presentation/ticket-presentation/intake.md`](../../stories/ticket-presentation/ticket-presentation/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) §6 "RD-1.14", decision D12. Binding semantics: [`docs/architecture/13-design-language.md`](../../../docs/architecture/13-design-language.md) "Status semantics". Independent review: QA-02.

---

## Prerequisites

- **Story 185 completed** (`7efabea`, RD-1.8). Badge has the `info` and `progress` variants and an optional decorative `icon` prop.
- **`@crm/shared`** is consumed from its built `dist`. Turbo runs `^build` before lint, typecheck, test and build, both locally and in CI.
  - Until now the frontends imported only types from it.
  - A runtime import was probed during recon: vitest resolves `ticketStatusPresentation` from `dist`.
  - Locally, run `pnpm --filter @crm/shared build` before the app suites.
- `@crm/ui` stays domain-free. It owns role-named icons, but never learns ticket values.

---

## Story Goal

One source of truth for how a ticket status or priority looks: tone, icon and localized label.

- The shared data lives in `@crm/shared`.
- Each app has a thin badge component that uses its own i18n.
- Every old variant helper is replaced.

This removes two collisions:
- OPEN and HIGH were both amber.
- IN_PROGRESS, LOW and MEDIUM were all grey.

It also means a status is never signalled by colour alone.

**Non-goals:**
- portal priority labels and badge (the portal has no priority labels yet; RD-1.16)
- SLA presentation (RD-1.15)
- token value changes (QA-02 escalates instead)
- the web detail page's status/priority `Select`s
- layout changes
- any backend, API, database, auth or routing change

---

## Design decisions

1. **The mapping is exactly the design language.**
   - Status: OPEN `info`, IN_PROGRESS `progress`, RESOLVED `success`, CLOSED `neutral`.
   - Priority: LOW and MEDIUM `neutral`, HIGH `warning`, URGENT `danger`.

   Because statuses never use warning/danger and priorities never use info/progress, a status and a priority side by side never share a tone, except that CLOSED and LOW/MEDIUM are both neutral. Those three are told apart by icon and label. The roadmap's AC names only OPEN ≠ HIGH and IN_PROGRESS ≠ LOW/MEDIUM.
2. **Tone to Badge variant** (in each app):
   - `neutral` → `secondary`
   - `info` → `info`
   - `progress` → `progress`
   - `success` → `success`
   - `warning` → `warning`
   - `danger` → `destructive`

   CLOSED moves from `outline` to `secondary`. That is intentional: one neutral treatment, with the archive icon carrying the meaning.
3. **Icons**, added to `@crm/ui`'s role-named icon module:

   | Icon | Lucide glyph |
   |---|---|
   | `StatusOpenIcon` | `CircleDot` |
   | `StatusInProgressIcon` | `CircleDotDashed` |
   | `StatusResolvedIcon` | `CircleCheck` |
   | `StatusClosedIcon` | `Archive` |
   | `PriorityLowIcon` | `SignalLow` |
   | `PriorityMediumIcon` | `SignalMedium` |
   | `PriorityHighIcon` | `SignalHigh` |
   | `PriorityUrgentIcon` | `OctagonAlert` |

   The shared data stores icon *keys* (`"status-open"` …) because `@crm/shared` has no React. Each app maps keys to icons.
4. **Unknown values** (the API ahead of the frontend) fall back to neutral, with the open/medium icon and the raw value passed through the existing label function. No crash. This is the same tolerance as the old helpers' default branch.
5. **Report bars** derive their colour from the shared tone:
   - info, progress and success → `rgb(var(--<family>-solid))`
   - neutral → `rgb(var(--rule-strong))`
   - warning → `rgb(var(--warning-solid))`
   - danger → `rgb(var(--danger-solid))`

   This keeps the existing function name `ticketStatusBarColor` and the call site. IN_PROGRESS changes from `ink-subtle` to `progress-solid`, and OPEN from `warning-solid` to `info-solid`. These are intentional visual-contract changes, so the spec assertions are updated.
6. **QA-02** (non-blocking): progress violet vs accent indigo.
   - Evidence: screenshots of IN_PROGRESS on a hovered list row (the list has no selected state) and next to the dashboard's primary "Claim" button, light and dark.
   - The badge always carries the dashed-circle icon and its label.
   - Record the judgement in `progress.md`. If it is confusable, raise a design-direction change and do **not** change tokens here.

---

## Context — Read These Files First

1. `docs/architecture/13-design-language.md` lines 26–36.
2. `apps/web/src/lib/ticket-badges.ts` (+ `.spec.ts`) and `apps/portal/src/lib/ticket-badges.ts` (+ `.spec.ts`). Both are deleted by this Story.
3. `packages/ui/src/components/badge.tsx` (variants, `icon`) and `packages/ui/src/lib/icons.ts` (+ `icons.spec.ts` `ROLES`).
4. `apps/web/src/hooks/use-ticket-labels.ts`; portal `tickets.status.*` keys.
5. Call sites:
   - web:
     - `tickets/ticket-list-view.tsx` ~372/377
     - `dashboard/dashboard-view.tsx` ~163/166 and ~378/381
     - `customers/customer-detail-view.tsx` ~687/690
     - `tickets/customer-context-panel.tsx` ~104/107
     - `dashboard/tasks-panel.tsx` ~143
     - `sla-policies/sla-policy-list-view.tsx` ~191
   - portal:
     - `portal/portal-home-view.tsx` ~147
     - `tickets/ticket-list-view.tsx` ~236
     - `tickets/ticket-detail-view.tsx` ~131
6. `apps/web/src/components/reporting/report-charts.tsx` ~21–26, ~181–189 (+ spec ~209–216).
7. Guards:
   - `apps/web/src/test/ticket-enum-messages.spec.ts`
   - `apps/portal/src/design-tokens.spec.ts` (the raw-enum child guard)
   - `apps/web/src/test/style-guard.spec.ts`

---

## Tasks

No backend changes required.

### 1 — Shared presentation data

**Create `packages/shared/src/ticket-presentation.ts`.** It exports:
- `TICKET_STATUSES`, `TICKET_PRIORITIES`, plus the value types
- `PresentationTone`, `TicketPresentationIcon`, `TicketPresentation`
- `TICKET_STATUS_PRESENTATION`, `TICKET_PRIORITY_PRESENTATION`
- the tolerant `ticketStatusPresentation(status)` and `ticketPriorityPresentation(priority)`

Re-export it from `packages/shared/src/index.ts`.

### 2 — Icons

**`packages/ui/src/lib/icons.ts`:** add the eight role icons (design decision 3) under a "Ticket status / priority" group, with a short comment.
**`packages/ui/src/lib/icons.spec.ts`:** add the eight names to `ROLES`.
**`packages/ui/src/index.ts`:** export them from the icons barrel.

### 3 — Web badges

**Create `apps/web/src/components/tickets/ticket-badges.tsx`.**
- `TONE_VARIANT: Record<PresentationTone, BadgeVariant>`
- `ICON: Record<TicketPresentationIcon, LucideIcon>`
- `TicketStatusBadge({ status, className? })`: `<Badge variant icon>{ticketLabels.status(status)}</Badge>`
- `TicketPriorityBadge({ priority, className? })`: the same, for priority. It also serves `TaskPriority`.

Export `TONE_VARIANT` and `ICON` for the portal? **No.** The portal keeps its own four-entry maps. That is a thin duplicate by design: apps don't import each other.

### 4 — Web call sites

Replace each pair `<Badge variant={ticket…BadgeVariant(x)}>{ticketLabels.…(x)}</Badge>` with `<TicketStatusBadge status={x} />` / `<TicketPriorityBadge priority={x} />`. The files:
- `ticket-list-view.tsx`
- `dashboard-view.tsx` (×2)
- `customer-detail-view.tsx`
- `customer-context-panel.tsx`
- `tasks-panel.tsx`
- `sla-policy-list-view.tsx` (was `outline`)

Remove the now-unused imports: `ticket-badges` and `Badge`/`useTicketLabels` where nothing else uses them.

### 5 — Portal badge and call sites

**Create `apps/portal/src/components/tickets/ticket-status-badge.tsx`:** `TicketStatusBadge({ status })` using `useTranslations("tickets")` `status.<VALUE>`, the shared map, and a four-entry icon map. Replace the three portal call sites. The `status.*` keys are unchanged.

### 6 — Reports

`report-charts.tsx`: `ticketStatusBarColor(status)` derives from `ticketStatusPresentation(status).tone` (design decision 5). Update the doc comments that reference `ticket-badges.ts`.

### 7 — Delete the old maps

`git rm`:
- `apps/web/src/lib/ticket-badges.ts` and `.spec.ts`
- `apps/portal/src/lib/ticket-badges.ts` and `.spec.ts`

Their behaviour is now covered by the badge specs and the shared-map spec. Comments in other files that cite `ticket-badges.ts` as a precedent (`portal/lib/list-query.ts`, `paginated.ts`, `use-ticket-labels.ts`, `badge.spec.tsx`, `portal/design-tokens.spec.ts`) are historical. Update only those that would now mislead a reader: `use-ticket-labels.ts` and `design-tokens.spec.ts` name the deleted helper as current.

---

## Edge Cases & Failure Modes

- **Unknown enum value.** Neutral tone, fallback icon, and the label function's own fallback. It never throws.
- **TaskPriority.** It has the same members, so `TicketPriorityBadge` serves it unchanged.
- **RTL.** The icons are direction-neutral (circles, signal bars, archive box, octagon), so nothing flips.
- **Dark mode.** The Badge variants use `*-surface` and `*-foreground`, which have dark values guarded by `token-contrast.spec.ts`.
- **Mobile table cards.** The badge swaps in place inside the existing `TableCell`, with no layout change.
- **Portal raw-enum guard.** The new component renders `{t(...)}`, and `{ticket.status}` is never a JSX child.

---

## Test Plan

1. **Create** `apps/web/src/components/tickets/ticket-badges.spec.tsx`:
   - every status (4) and priority (4), in en and ar, renders the localized label, an `aria-hidden` svg and the expected variant class (`bg-info-surface`, `bg-progress-surface`, `bg-success-surface`, `bg-surface-muted`; `bg-warning-surface`, `bg-danger-surface`);
   - OPEN's tone differs from HIGH's, and IN_PROGRESS's from LOW/MEDIUM's;
   - all eight icons are distinct;
   - an unknown value renders neutral without throwing.
2. **Create** `apps/web/src/lib/ticket-presentation.spec.ts`. It tests the shared map, which has no test runner of its own:
   - status tones never use warning/danger, and priority tones never use info/progress;
   - every value has an entry and the icons are unique;
   - the lookups are tolerant.
3. **Create** `apps/portal/src/components/tickets/ticket-status-badge.spec.tsx`: 4 statuses × en/ar, with the label, icon and variant class.
4. **Modify** `report-charts.spec.tsx` (~209–216) to the new bar colours, which are an intentional contract change.
5. **Modify** `packages/ui/src/lib/icons.spec.ts` `ROLES`.
6. **Delete** both `ticket-badges.spec.ts`; their subject is deleted.
7. **Unchanged, must pass:**
   - the view specs of every call site (they query by text and role)
   - `ticket-enum-messages.spec.ts`
   - the portal `design-tokens.spec.ts`
   - the style guard

---

## Verification Steps

1. `pnpm --filter @crm/shared build`, then `pnpm --filter @crm/ui test`, `pnpm --filter @crm/web test`, `pnpm --filter @crm/portal test`.
2. Typecheck and lint for shared, ui, web and portal.
3. Stop the production servers, then run the web and portal builds.
4. **Harness** (production servers, seeded data):
   - **Web:** ticket list and dashboard at 320 and 1280 × en/ar × light/dark. Check:
     - every status/priority badge has an svg and a non-empty label;
     - no Latin enum text in ar;
     - OPEN/HIGH and IN_PROGRESS/LOW/MEDIUM computed backgrounds differ;
     - 0 overflow.
   - **Portal:** the ticket list, the same checks for status.
   - **QA-02 screenshots:** an IN_PROGRESS row hovered on the ticket list, and an IN_PROGRESS badge beside the dashboard "Claim" primary button (or the nearest primary button), light and dark, compared with the computed accent colour.
5. Run `git diff --check`, review the complete diff, and confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] `@crm/shared` presentation data matches `13-design-language.md`; the tolerant lookups.
- [ ] Eight role icons in `@crm/ui`; `icons.spec` updated.
- [ ] Web `TicketStatusBadge`/`TicketPriorityBadge` and portal `TicketStatusBadge` replace every helper call site; the SLA-policy and task priority badges included.
- [ ] Both `ticket-badges.ts` maps (+ specs) deleted; no references to the deleted helpers remain in code.
- [ ] Report status bars use the shared tones.
- [ ] Specs over all 8 values in en/ar; existing guards green.
- [ ] QA-02 screenshots taken and the judgement recorded.
- [ ] Tests, typecheck, lint and builds pass; no backend, API, database, auth or routing change.

---

## Implementation notes

- **Overflow from the icons (fixed in this Story).** Each badge gained a 14px icon plus a 4px gap, so a status + priority cluster is about 36px wider. At 320px the harness found that two no-wrap clusters overflowed. Both are regressions caused by this Story:
  - the dashboard rows: 28px;
  - the customer detail related-tickets row: 23px en, 8px ar.

  The minimal fix is `flex-wrap`: on the two dashboard clusters, and on the customer-detail row and cluster (with `gap-2`). This only takes effect when a row doesn't fit. A side effect: in the narrow "Unclaimed tickets" panel at desktop width, the SLA text and Claim button now wrap to a second line instead of squeezing the subject. The dashboard is redesigned in RD-4.x.
- **Web ticket detail** shows status and priority as `Select`s (non-goal), so it has no badges.
