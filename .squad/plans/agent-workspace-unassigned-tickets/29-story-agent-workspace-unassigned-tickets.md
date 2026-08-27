# Story 29 — Agent Workspace: Unassigned Tickets & Self-Assign

## Prerequisites

- `agent-workspace-ticket-operations-mvp` Story 23 completed: `PATCH /tickets/:id`, `ticket:update` permission, `useUpdateTicketMutation`.
- `agent-workspace-real-dashboard` Story 28 completed: `DashboardView`, `OPEN_STATUSES`, `slaSortKey`, `SlaPresentation`, `priorityBadgeVariant`, `customerNameById`. Extended, not replaced.

---

## Story Goal

Add a second Dashboard section, "Unclaimed tickets" — open tickets with no assignee — each with a "Claim" action reusing the existing `PATCH /tickets/:id` assignment mechanism.

**Not in scope**: any change to `TicketListView`'s filters, reassignment of already-assigned tickets through this section, automatic/rule-based assignment, any new backend endpoint/DTO field/permission, SLA/notification/customer/admin/KB/AI/Portal/Reporting/Integrations work of any kind.

---

## Context — Read These Files First

1. `apps/web/src/components/dashboard/dashboard-view.tsx` (Story 28, whole file) — the exact `OPEN_STATUSES`/`slaSortKey`/`SlaPresentation`/`priorityBadgeVariant`/`customerNameById` this story reuses verbatim.
2. `apps/web/src/hooks/use-tickets.ts` — `useTicketsQuery(filters)` called with `{}` for the unfiltered branch list; `useUpdateTicketMutation(id)` — its existing `["tickets"]`-prefix invalidation already refreshes both of the Dashboard's queries.
3. `apps/api/src/modules/tickets/dto/list-tickets-query.dto.ts` / `update-ticket.dto.ts` / `tickets.controller.ts` — confirms `assignedToUserId` is `@IsUUID()`-only (no "unassigned" filter possible server-side) and that `PATCH /tickets/:id` already accepts `{ assignedToUserId }` under `ticket:update`.
4. `apps/web/src/components/tickets/ticket-list-view.tsx` — the `SlaCell`/`FilterSelect`/`ListSkeleton` local-subcomponent-in-same-file precedent this story's `UnclaimedTicketRow` follows.

---

## Design (resolved during this planning pass)

1. **Client-side filtering only, no new backend parameter.** `ListTicketsQueryDto.assignedToUserId` cannot express "no assignee." The queue is `useTicketsQuery({})`'s already-unfiltered result, narrowed client-side to `assignedToUserId === null && OPEN_STATUSES.has(status)` — the same pattern Story 27/28 already established.
2. **The queue lives on the Dashboard, not the Ticket List.** The Ticket List's filters are all real server-side query parameters; "no assignee" has no backend equivalent, so it does not belong there. `TicketListView` is not modified.
3. **`UnclaimedTicketRow` is a local, non-exported subcomponent inside `dashboard-view.tsx`** (a deliberate, disclosed deviation from an earlier separate-file sketch) — `useUpdateTicketMutation(id)` must be called once per row, not inside `.map()`, and this codebase's own precedent for small per-row/per-field subcomponents (`SlaCell`, `FilterSelect`, `ListSkeleton` in `ticket-list-view.tsx`; `Field` in `ticket-detail-view.tsx`) is to keep them alongside their parent, not split into new files — this also avoids a circular import between two sibling files that would otherwise both need the same SLA-presentation helpers.
4. **Claim payload**: `{ assignedToUserId: userId }` via the existing mutation — identical to `TicketDetailView`'s assignee `Select`.
5. **No navigation after a successful claim** — an agent triaging a queue should be able to claim several tickets in one sitting; the row disappears once the existing `["tickets"]` invalidation triggers a real refetch, never assumed optimistically.
6. **New i18n keys live under the existing `dashboard.*` namespace** (`unassignedHeading`, `unassignedEmpty`, `unassignedError`, `claimButton`, `claiming`, `claimForbidden`, `claimFailed`), matching this repo's established per-domain string-duplication convention rather than cross-referencing `tickets.detail.actionForbidden`/`actionFailed`.

---

## Implementation Tasks

### 1 — `DashboardView`: second data source

File: `apps/web/src/components/dashboard/dashboard-view.tsx`

- Add `const allTicketsQuery = useTicketsQuery({});` alongside the existing `myTicketsQuery` (renamed from `ticketsQuery` for clarity between the two).
- Derive `unclaimedTickets` via the same urgency-sort helper, filtered to `assignedToUserId === null && OPEN_STATUSES.has(status)`.

### 2 — `UnclaimedTicketRow` (local subcomponent)

- Calls `useUpdateTicketMutation(ticket.id)` once per instance.
- Renders subject/customer-name/status/priority/SLA (reusing `SlaPresentation`/`priorityBadgeVariant`) plus a "Claim" `Button` (`disabled={mutation.isPending}`, `onClick` → `mutation.mutate({ assignedToUserId: currentUserId })`).
- Renders an inline 403-vs-generic error under the row on `mutation.isError`.
- Row click → `tickets/{id}`; customer-name click → `customers/{id}` (both `stopPropagation()`'d from the Claim button and each other, matching "My open tickets"' existing pattern).

### 3 — i18n

Extend `apps/web/messages/{en,ar}.json`'s `dashboard.*` with the 7 new keys listed in Design item 6.

### 4 — Tests

Extend `dashboard-view.spec.tsx`: independent loading/error/empty for the new section; correct filtering (unassigned+open only, excluding assigned/resolved/closed); claim calls the mutation with the correct id/payload; pending disables the button; 403 vs. generic error message; row/customer navigation still work.

---

## Edge Cases & Failure Modes

- **Both dashboard queries fail independently**: each section shows its own `Alert`+retry, matching the existing "My open tickets" vs. Related-Tickets-card independent-failure precedent from Story 27.
- **No unassigned open tickets exist**: empty-state paragraph, not an error.
- **A claim is rejected (403 or otherwise)**: the ticket remains in the Unclaimed list, unchanged, with an inline message — never removed speculatively.
- **Two agents race to claim the same ticket**: whichever `PATCH` the backend processes first wins (existing backend behavior, unchanged); the loser's client-side row simply refetches on invalidation and disappears once the real state shows someone else now owns it — no new concurrency handling invented.

---

## Test Plan

1. **Unit/component — `dashboard-view.spec.tsx`**: as listed in Implementation Task 4.
2. **Regression**: full existing `apps/web` suite remains green. `apps/api`/`apps/worker` unaffected (no backend files touched) — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change. Rollback is a plain code revert.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): real login; real `GET /tickets` to reconfirm the current unassigned-open population; real `PATCH /tickets/:id` claim against one real unassigned ticket, re-fetched to confirm the assignment genuinely changed and the unassigned count dropped by one — reported as a real, permanent side effect.
4. `pnpm --filter @crm/api test:e2e` — regression only.
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, `TicketListView`, `TicketDetailView`, `CustomerDetailView`, and every protected realtime/SLA/notification file have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] Dashboard shows both "My open tickets" and "Unclaimed tickets."
- [ ] The unclaimed queue is genuinely scoped to `assignedToUserId === null` + open status.
- [ ] Claim reuses the existing `PATCH /tickets/:id`/`ticket:update` mechanism with no new contract.
- [ ] No navigation on successful claim; the row disappears only once the real refetch confirms it.
- [ ] Rejected claims show an inline, 403-aware error and leave the ticket in place.
- [ ] `TicketListView`, `TicketDetailView`, `CustomerDetailView` byte-for-byte unchanged.
- [ ] `RealtimeGateway`, its listeners, every SLA-policies file, `schema.prisma`, migrations, and `TicketsController`/`TicketsService`/DTOs byte-for-byte unchanged.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass; existing tests remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
