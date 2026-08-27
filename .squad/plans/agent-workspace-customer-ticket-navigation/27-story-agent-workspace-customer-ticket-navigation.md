# Story 27 — Agent Workspace: Customer-to-Ticket Navigation

## Prerequisites

- `agent-workspace-ticket-operations-mvp` Story 23 completed: `useTicketsQuery`, `TicketListItem` (with `customerId`), `TicketListView`'s row/badge conventions. Not modified except where this plan names an extraction.
- `agent-workspace-ticket-customer-creation` Story 25 completed: `CreateTicketView`, `useCreateTicketMutation`, `useCustomersQuery`. Extended, not replaced.
- `agent-workspace-customer-management` Story 26 completed: `CustomerDetailView`, `useCustomerQuery`, the ticket→customer "View customer" link this story completes the loop for. Extended, not replaced.

---

## Story Goal

Close the remaining one-directional gap in Agent Workspace navigation: give `CustomerDetailView` a "Related tickets" section (client-side filtered from the existing, already-fetched, unpaginated `GET /tickets` result) plus a "New ticket" action that deep-links to `tickets/new?customerId={id}`, and make `CreateTicketView` read that optional query parameter to pre-select the customer.

**Not in scope**: customer editing, contact CRUD, ticket search/pagination, any backend `customerId` filter parameter or new endpoint, Prisma/migration changes, realtime, worker, notification/presence/domain work of any kind.

---

## Context — Read These Files First

1. `apps/web/src/components/customers/customer-detail-view.tsx` (Story 26, whole file) — the exact card/section shape (`Contacts` card) this story's new "Related tickets" card mirrors.
2. `apps/web/src/components/tickets/ticket-list-view.tsx` (Story 23, whole file) — the row/`Badge` conventions (status/priority badges, `Table`) this story's related-tickets list reuses at a reduced column set (no filters/sort needed here — this is a fixed, customer-scoped subset, not a general list).
3. `apps/web/src/hooks/use-tickets.ts` — `useTicketsQuery(filters)` already exists and, called with `{}`, already returns the full branch ticket list (Story 23) — this story calls it exactly this way from `CustomerDetailView`, then filters client-side by `ticket.customerId === customerId`. No new hook is added for this.
4. `apps/web/src/components/tickets/create-ticket-view.tsx` (Story 25, whole file) — the exact `customerId` state (`useState("")`) this story seeds from a query parameter instead of always starting empty; the existing `Select`/`useCustomersQuery` picker is reused verbatim.
5. `apps/web/src/lib/tickets-api.ts` — `TicketListItem` already has `customerId` (Story 23); `CustomerSummary` already has `id`/`displayName`/`isActive` (Story 26) — nothing here changes.
6. `apps/web/src/app/[locale]/(agent)/customers/[id]/page.tsx` / `tickets/new/page.tsx` — both are thin wrappers already; neither needs a change, since Next.js's `useSearchParams()` is read inside the client component itself, not passed via route props.

---

## Design (resolved during this planning pass)

1. **Client-side filtering only — confirmed sufficient and intentional.** `ListTicketsQueryDto` has no `customerId` field (confirmed by inspection) and none is added. `useTicketsQuery({})` already fetches every ticket in the branch (no pagination exists anywhere in this repo); filtering that already-in-memory array by `customerId` client-side is the same pattern `TicketListView` already uses for its own customer/agent name-resolution joins — not a new architectural pattern.
2. **"Related tickets" card mirrors the existing "Contacts" card's shape**, not `TicketListView`'s full filterable table — this is a fixed, small, customer-scoped subset with no filters/sort of its own (out of scope), so a lighter list (subject, status badge, priority badge, created date, row-click navigation to `tickets/{id}`) is enough; the full `TicketListView` component is not reused wholesale, since its filter/sort UI has no meaning for an already-fixed subset.
3. **`customerId` query parameter read via `useSearchParams()`** (`next/navigation`) — the standard Next.js App Router mechanism for a client component to read a query string value; this is this codebase's first use of the hook, but it requires no new dependency and no new pattern beyond what Next.js itself already provides alongside `useParams`/`useRouter`, which `CreateTicketView` already imports from the same module.
4. **Pre-selection, not a hard lock.** On mount, if `customerId` from the query string matches an id present in `useCustomersQuery().data`, `CreateTicketView`'s existing `customerId` state is seeded with it via a `useEffect` — the existing `Select` remains fully interactive afterward (Design requirement: "the agent can still change the selected customer"). If the query param is absent, unknown, or the customers list hasn't loaded yet, the state simply stays `""` — identical to today's behavior, no special-case branching needed beyond the seed itself.
5. **"New ticket" button on `CustomerDetailView`** is a plain `router.push` to `` `/${locale}/tickets/new?customerId=${customerId}` ``, mirroring the existing "New customer"/"New ticket" buttons already on `CustomerListView`/`TicketListView`.

---

## Implementation Tasks

### 1 — `CustomerDetailView`: Related Tickets section

File: `apps/web/src/components/customers/customer-detail-view.tsx`

- Add `const ticketsQuery = useTicketsQuery({});` and derive `const relatedTickets = (ticketsQuery.data ?? []).filter((ticket) => ticket.customerId === customerId);`.
- Add a new bordered card (matching the Contacts card's shape) titled via a new `detail.ticketsHeading` key, containing:
  - `ticketsQuery.isLoading` → `Skeleton`.
  - `ticketsQuery.isError` → `Alert` (`detail.ticketsError`).
  - `ticketsQuery.isSuccess && relatedTickets.length === 0` → empty-state paragraph (`detail.ticketsEmpty`).
  - `ticketsQuery.isSuccess && relatedTickets.length > 0` → a list of rows (subject, status `Badge`, priority `Badge`, created date), each row navigating to `tickets/{id}` on click, mirroring `TicketListView`'s row-click convention.
- Add a "New ticket" `Button` near the section header, `onClick={() => router.push(\`/${locale}/tickets/new?customerId=${customerId}\`)}` — needs `useRouter`/`useParams` added to this component (not previously imported here since it was read-only).

### 2 — `CreateTicketView`: `customerId` prefill

File: `apps/web/src/components/tickets/create-ticket-view.tsx`

- Import `useSearchParams` alongside the existing `useParams`/`useRouter`.
- `const searchParams = useSearchParams(); const prefilledCustomerId = searchParams.get("customerId");`
- `useEffect(() => { if (prefilledCustomerId && (customersQuery.data ?? []).some((c) => c.id === prefilledCustomerId)) { setCustomerId(prefilledCustomerId); } }, [prefilledCustomerId, customersQuery.data]);` — only seeds the state; the existing `Select`'s `onValueChange={setCustomerId}` is completely unchanged, so the agent can still pick a different customer afterward.
- No change to `handleSubmit`, the DTO shape sent, or any other field.

### 3 — i18n

Extend `apps/web/messages/{en,ar}.json`'s `customers.detail.*` with `ticketsHeading`, `ticketsEmpty`, `ticketsError`, `newTicketButton`.

### 4 — Tests

- `customer-detail-view.spec.tsx`: extend with cases for related tickets rendering (only matching `customerId`), row navigation, empty state, loading, error, and the "New ticket" button's navigation target (`/en/tickets/new?customerId=...`).
- `create-ticket-view.spec.tsx`: extend with cases for (a) no `customerId` param → unchanged existing behavior, (b) a valid `customerId` param matching a loaded customer → picker pre-selected, still changeable, (c) an unknown/invalid `customerId` param → picker stays unselected, no crash.

---

## Edge Cases & Failure Modes

- **`ticketsQuery` (the full branch list) fails to load on the customer detail page**: the Related Tickets card shows its own `Alert`, independent of whether the Contacts section (a different query) succeeded — the two cards fail independently, matching how `TicketDetailView`'s history/SLA cards already fail independently of the main ticket fetch.
- **A customer has zero tickets**: empty-state paragraph, not an error.
- **`customerId` query param present but the customers list hasn't loaded yet**: the `useEffect`'s guard (`(customersQuery.data ?? []).some(...)`) simply doesn't match yet and re-runs once `customersQuery.data` arrives (it's a `useEffect` dependency) — no race, no flash of wrong state, since the `Select` starts unselected either way until the effect fires.
- **`customerId` query param doesn't match any real customer** (stale link, typo, deleted customer): the picker simply stays unselected — identical to today's default behavior, not a new error state.

---

## Test Plan

1. **Unit/component — `customer-detail-view.spec.tsx`**: related tickets filtered correctly by `customerId`; unrelated tickets excluded; row click navigates to `tickets/{id}`; empty/loading/error states; "New ticket" button navigates with the correct query string.
2. **Unit/component — `create-ticket-view.spec.tsx`**: unchanged behavior with no `customerId` param; correct pre-selection with a valid param; picker remains changeable afterward; safe (no crash, no selection) with an invalid/unknown param.
3. **Regression**: full existing `apps/web` suite, in particular every existing `ticket-*`/`customer-*` spec, remains green. `apps/api`/`apps/worker` unaffected (no backend files touched) — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change. Rollback is a plain code revert.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; `pnpm typecheck`/`lint`/`build` workspace-wide.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): real `GET /tickets` call confirming multiple rows share a `customerId`, used to sanity-check the client-side filter logic against real data; real route checks for the two modified pages.
4. `pnpm --filter @crm/api test:e2e` — regression only, confirms no backend change was required or made.
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, and every protected realtime/SLA/notification file have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] `CustomerDetailView` shows only tickets whose `customerId` matches the current customer, with working loading/error/empty states.
- [ ] Each related ticket row navigates to the real `tickets/{id}` detail page.
- [ ] A "New ticket" action on the customer detail page navigates to `tickets/new?customerId={id}`.
- [ ] `CreateTicketView` pre-selects the customer from a valid `customerId` query parameter, remains changeable, and is unaffected when the parameter is absent or invalid.
- [ ] No new backend endpoint, DTO, permission, Prisma model, migration, realtime event, or SLA behavior.
- [ ] `RealtimeGateway`, `TicketRealtimeListener`, `BranchNotificationRealtimeListener`, `NotificationLog`/its listeners, every SLA-policies file, `schema.prisma`, and migrations remain byte-for-byte unchanged.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass; existing tests remain green.
- [ ] Full existing `apps/web`/`apps/api`/`apps/worker` suites remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
