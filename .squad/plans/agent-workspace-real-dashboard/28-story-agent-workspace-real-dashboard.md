# Story 28 — Agent Workspace: Real Agent Dashboard

## Prerequisites

- `agent-workspace-ticket-operations-mvp` Story 23 completed: `useTicketsQuery`/`useCustomersQuery`, `TicketListItem`, `deriveSlaStatus`/`formatRemaining`, the `(agent)/layout.tsx` auth guard. Not modified except where this plan names an extraction.

---

## Story Goal

Replace the `/dashboard` redirect stub with a real dashboard: the authenticated agent's own open (`OPEN`/`IN_PROGRESS`) tickets, ordered by SLA urgency, using only the existing `GET /tickets?assignedToUserId=` and `GET /auth/me` contracts.

**Not in scope**: customer editing, contact CRUD, customer interaction history, notes/attachments, admin UI, SLA policy configuration UI, notification center/history, agent presence/team collaboration, tasks/reminders/quick replies, any new "at risk" SLA concept, any filter/sort/search/pagination UI on the dashboard itself, Knowledge Base, AI, Customer Portal, Reporting, Integrations, generalized `AutomationRule`.

---

## Context — Read These Files First

1. `apps/web/src/app/[locale]/(agent)/dashboard/page.tsx` (Story 23's redirect stub) — replaced in full by this story.
2. `apps/web/src/app/[locale]/(agent)/layout.tsx` — the private `fetchMe()` this story extracts verbatim to a shared helper.
3. `apps/web/src/components/tickets/ticket-list-view.tsx` — the `priorityBadgeVariant`/SLA-presentation/`customerNameById` precedent this story's dashboard mirrors at a reduced, fixed (non-filterable) scope.
4. `apps/web/src/components/customers/customer-detail-view.tsx` (Story 27) — the precedent for a lighter `<ul>` row-list (not a full filterable `Table`) over a fixed, pre-scoped ticket subset, and for duplicating a small presentational helper rather than extracting a shared component.
5. `apps/web/src/lib/sla.ts` — `deriveSlaStatus`/`formatRemaining`, reused verbatim; its own doc comment already states the "earliest target governs urgency" reading this story's sort implements.
6. `apps/web/src/hooks/use-tickets.ts` — `useTicketsQuery(filters)`, `useCustomersQuery()`, reused unmodified.
7. `packages/shared/src/auth.ts` — `AuthenticatedUser.id`, the value the new page filters by.

---

## Design (resolved during this planning pass)

1. **Client-side status filtering, not a second backend contract.** `ListTicketsQueryDto.status` only accepts one value; fetching "OPEN or IN_PROGRESS" in a single server call isn't possible without a new backend parameter, which this story does not add. Instead, `GET /tickets?assignedToUserId=<id>` (no `status` filter) is fetched once, and `RESOLVED`/`CLOSED` tickets are excluded client-side — the same "fetch the already-scoped, unpaginated result, refine client-side" pattern Story 27 established for `CustomerDetailView`.
2. **SLA-urgency ordering is presentation-only.** Tickets are sorted breached-first, then by soonest remaining target, then no-target-last, using only `deriveSlaStatus`'s existing `kind`/`targetAt`/`remainingMs` output as the sort key — no new "at risk" threshold, no reproduction of the backend's internal warning window.
3. **A single `now` shared by sort and render.** `now = new Date()` is computed once per fetched result (inside the same `useMemo` that filters/sorts), then passed into every `SlaPresentation` render — so the on-screen remaining-time text can never disagree with the row ordering.
4. **A `<ul>` row-list, not the full `Table`/filter-bar `TicketListView` uses.** The dashboard is a fixed, pre-scoped view with no filters/sort/search of its own — the same reasoning Story 27 already applied to `CustomerDetailView`'s Related Tickets section applies here.
5. **`fetchMe()` extracted verbatim to `apps/web/src/lib/auth-server.ts` as `fetchCurrentUser()`**, imported by both `(agent)/layout.tsx` (behavior unchanged) and the new `dashboard/page.tsx` — avoiding two independently-drifting implementations of "who am I," which the dashboard genuinely needs (not an unrelated refactor).
6. **`priorityBadgeVariant` duplicated locally**, not imported from `ticket-list-view.tsx` (which doesn't export it) — mirroring the exact precedent `customer-detail-view.tsx` already set for this helper.

---

## Implementation Tasks

### 1 — Shared auth helper

File: `apps/web/src/lib/auth-server.ts` (new)

- `fetchCurrentUser(): Promise<AuthenticatedUser | null>` — verbatim body of `(agent)/layout.tsx`'s original `fetchMe()`.

### 2 — `(agent)/layout.tsx`

- Replace the inline `fetchMe()` definition with `import { fetchCurrentUser } from "@/lib/auth-server"`; call `fetchCurrentUser()` in place of `fetchMe()`. No other behavior change.

### 3 — `(agent)/dashboard/page.tsx`

- Replace the redirect stub: resolve `user = await fetchCurrentUser()`; if `null`, `redirect` to `login` (mirrors the layout's own guard, defensive only); otherwise render `<DashboardView userId={user.id} />`.

### 4 — `DashboardView`

File: `apps/web/src/components/dashboard/dashboard-view.tsx` (new)

- `useTicketsQuery({ assignedToUserId: userId })`, `useCustomersQuery()` for name resolution.
- Filter to `OPEN`/`IN_PROGRESS`, sort by SLA urgency (Design item 2/3).
- Loading (`Skeleton`), error (`Alert` + retry), empty (dashed-border paragraph), populated (`<ul>` rows: subject, customer-name button, status `Badge`, priority `Badge`, SLA presentation) states, mirroring `TicketListView`'s/`CustomerDetailView`'s existing conventions.
- Row click → `tickets/{id}`; customer-name click → `customers/{id}` with `stopPropagation()`.

### 5 — i18n

New `dashboard.*` namespace in `apps/web/messages/{en,ar}.json`: `title`, `heading`, `error`, `retry`, `empty`.

### 6 — Tests

`dashboard-view.spec.tsx`: loading, error+retry, empty, scoping (`useTicketsQuery` called with `{ assignedToUserId }`), status-exclusion, SLA-urgency ordering, row navigation, customer-name navigation (without double-navigating), EN/AR rendering via real `NextIntlClientProvider`.

---

## Edge Cases & Failure Modes

- **Agent has zero open assigned tickets**: empty-state paragraph, not an error — even if the branch has many other tickets assigned to other agents or in other statuses.
- **`GET /tickets` fails**: error state + retry, independent of any other query on the page.
- **Two tickets share the same SLA-urgency rank** (e.g., both breached): stable sort by `targetAt` (soonest/most-overdue first) resolves ties deterministically.
- **Token expires between the layout's guard and the page's own `fetchCurrentUser()` call**: the page redirects to `login` itself — a defensive mirror of the layout's existing guard, not a new auth mechanism.

---

## Test Plan

1. **Unit/component — `dashboard-view.spec.tsx`**: as listed in Implementation Task 6.
2. **Regression**: full existing `apps/web` suite remains green, in particular every `ticket-*`/`customer-*` spec (the `(agent)/layout.tsx` behavior change is a pure extraction with identical runtime behavior). `apps/api`/`apps/worker` unaffected (no backend files touched) — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change. Rollback is a plain code revert.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): real login; real `GET /auth/me`; real `GET /tickets?assignedToUserId=<id>` compared against the real unfiltered `GET /tickets` count to confirm the filter genuinely narrows results; real SSR check that `/dashboard` no longer redirects for an authenticated request while still redirecting an unauthenticated one.
4. `pnpm --filter @crm/api test:e2e` — regression only, confirms no backend change was required or made.
5. Hygiene: `git status`; confirm `apps/api/**`, `apps/worker/**`, `schema.prisma`, migrations, and every protected realtime/SLA/notification file have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] `/dashboard` renders a real, agent-scoped view instead of redirecting to `/tickets`.
- [ ] The tickets query is genuinely scoped to the authenticated agent (`assignedToUserId`), never the branch-wide list.
- [ ] `RESOLVED`/`CLOSED` tickets are excluded from the populated list.
- [ ] Rows are ordered breached-first, then soonest-remaining, then no-target-last.
- [ ] Row and customer-name navigation both work and don't interfere with each other.
- [ ] Unauthenticated `/dashboard` requests still redirect to `login`.
- [ ] No new backend endpoint, DTO, permission, Prisma model, migration, realtime event, or SLA/business rule.
- [ ] `RealtimeGateway`, `TicketRealtimeListener`, `BranchNotificationRealtimeListener`, `NotificationLog`/its listeners, every SLA-policies file, `schema.prisma`, migrations, and `TicketsController`/`TicketsService`/DTOs remain byte-for-byte unchanged.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass; existing tests remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
