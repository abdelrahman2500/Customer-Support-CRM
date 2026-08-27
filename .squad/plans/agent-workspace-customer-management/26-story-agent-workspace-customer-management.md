# Story 26 — Agent Workspace: Customer List & Detail

## Prerequisites

- `customer-management` Story 06 completed: `GET /customers` (`CustomersController.list`/`CustomersService.listCustomers`, `customer:read`) and `GET /customers/:id` (`CustomersController.getOne`/`CustomersService.getCustomer`, `customer:read`) — the latter returns `CustomerSummary & { contacts: ContactSummary[] }`, contacts already embedded. Neither is modified by this story.
- `agent-workspace-ticket-operations-mvp` Story 23 completed: `ui/` primitives, TanStack Query hooks/conventions, the `(agent)` auth-guard layout, and the Ticket List/Detail UI patterns this story mirrors verbatim onto the Customers domain.
- `agent-workspace-ticket-customer-creation` Story 25 completed: `customers/new` route, `useCustomersQuery()` (already fetches the full branch customer list, reused unmodified by the new list screen), `CustomerSummary`/`createCustomer` in `apps/web/src/lib/tickets-api.ts`.

---

## Story Goal

Give the Agent Workspace a customer list and a customer detail screen (with read-only contacts), using exactly the existing `GET /customers`/`GET /customers/:id` contracts. This closes the "created a customer, can never see it again" gap Story 25 left open.

**Not in scope**: customer editing (`PATCH /customers/:id`), contact create/edit/delete, customer search/pagination/bulk import, attachments, comments, rich text, any ticket-creation change, any new backend endpoint, Prisma/migration change, realtime change, SLA change, notification change, Portal/Channels/AI/Reporting/Administration/Integrations/`AutomationRule`/Presence.

---

## Context — Read These Files First

1. `apps/api/src/modules/customers/customers.controller.ts` / `.service.ts` (read in full) — `GET /customers` returns `CustomerSummary[]` (`{ id, displayName, isActive }`); `GET /customers/:id` returns `CustomerSummary & { contacts: ContactSummary[] }` where `ContactSummary = { id, fullName, email, phone, isPrimary }`. Both already branch-scoped via `TenantContext`, already permissioned (`customer:read`), already e2e-tested (`apps/api/test/customers.e2e-spec.ts`).
2. `apps/web/src/lib/tickets-api.ts` (whole file) — current `CustomerSummary` interface only has `{ id, displayName }` (missing `isActive`, present on the backend). `listCustomers()`/`createCustomer()` already exist; this story adds `getCustomer(id)` and widens `CustomerSummary`.
3. `apps/web/src/hooks/use-tickets.ts` — `useCustomersQuery()` (5-minute `staleTime`, already used by three screens) is reused unmodified by the new list screen; this story adds `useCustomerQuery(id)` mirroring `useTicketQuery(id)`.
4. `apps/web/src/components/tickets/ticket-list-view.tsx` (whole file) — the exact list-screen shape this story mirrors: title + "create" button row, `Skeleton` loading, `Alert` + retry error, empty-state paragraph, `Table` with `TableRow` `onClick` navigation.
5. `apps/web/src/components/tickets/ticket-detail-view.tsx` (whole file) — the exact detail-screen shape this story mirrors: `Skeleton` loading, `Alert` with a 404-vs-generic distinction (`detail.notFound`/`detail.loadError`), a bordered info card, a second bordered card for a sub-list (history there; contacts here).
6. `apps/web/src/app/[locale]/(agent)/tickets/page.tsx` / `tickets/[id]/page.tsx` (Story 23) and `customers/new/page.tsx` (Story 25) — the exact thin-route-wrapper convention `customers/page.tsx`/`customers/[id]/page.tsx` follow.
7. `apps/web/src/components/tickets/ticket-list-view.tsx` line ~189 (`customerNameById.get(ticket.customerId) ?? ticket.customerId` cell) and `ticket-detail-view.tsx` line ~94 (the same lookup) — the two existing "displays a resolved customer name" spots this story adds a "View customer" link to.

---

## Design (resolved during this planning pass)

1. **Contacts come from the already-embedded `GET /customers/:id` response — no second request.** Confirmed by direct inspection (Context item 1): `CustomersService.getCustomer` already does `include: { contacts: true }` and returns them inline. Adding a separate `useContactsQuery` calling `GET /customers/:id/contacts` would be a redundant second request for data the detail screen's own primary fetch already carries — not introduced.
2. **`CustomerSummary` widens to include `isActive`** (already returned by the backend, simply not yet typed on the frontend) — the same additive-widening move Story 23 made for `TicketSummary`'s `createdAt`/`updatedAt`. A new `ContactSummary` and `CustomerDetail extends CustomerSummary { contacts: ContactSummary[] }` type are added alongside it.
3. **List and detail are dedicated routes** (`customers/page.tsx`, `customers/[id]/page.tsx`), mirroring Story 23/25's routing convention exactly — no modal, matching this repository's now-established pattern of never activating the installed-but-unused `@radix-ui/react-dialog`.
4. **No search, no pagination** — mirrors the Ticket List's own accepted, unmodified limitation; `CustomersController` has no query parameters of any kind (confirmed unchanged since Story 23's own equivalent finding for tickets).
5. **"View customer" link added at the two existing customer-name display spots** (Context item 7), navigating to `customers/{id}` — additive only; neither existing cell's displayed text or data changes.
6. **Never optimistic; loading/error/empty states mirror Ticket List/Detail exactly** — `Skeleton` while loading, `Alert` (with the same 404-vs-generic distinction `TicketDetailView` already uses) on error, a plain paragraph for "no customers"/"no contacts."
7. **Read-only.** No mutation hook is added for customers in this story — `PATCH /customers/:id` and all Contacts endpoints beyond the embedded read stay unused by the frontend, per the intake's explicit deferral.

---

## Implementation Tasks

### 1 — API client additions

File: `apps/web/src/lib/tickets-api.ts`

- Widen `CustomerSummary` to `{ id, displayName, isActive }`.
- Add `ContactSummary { id, fullName, email: string | null, phone: string | null, isPrimary: boolean }`.
- Add `CustomerDetail extends CustomerSummary { contacts: ContactSummary[] }`.
- Add `getCustomer(id: string): Promise<CustomerDetail>` → `apiFetch<CustomerDetail>(\`/customers/${id}\`)`.

### 2 — Query hook

File: `apps/web/src/hooks/use-tickets.ts` — add `useCustomerQuery(id: string)` mirroring `useTicketQuery(id)` exactly (`queryKey: ["customer", id]`, `queryFn: () => getCustomer(id)`).

### 3 — `CustomerListView` + route

New files:
- `apps/web/src/components/customers/customer-list-view.tsx` — mirrors `TicketListView`'s structure minus filters/sort (Design item 4): title + "New customer" button (linking to the existing `customers/new`), `useCustomersQuery()`, loading `Skeleton`, error `Alert` + retry, empty-state paragraph, a `Table` (columns: name, status badge for `isActive`) with row-click navigation to `customers/{id}`.
- `apps/web/src/app/[locale]/(agent)/customers/page.tsx` — thin wrapper.

### 4 — `CustomerDetailView` + route

New files:
- `apps/web/src/components/customers/customer-detail-view.tsx` — mirrors `TicketDetailView`'s structure: loading `Skeleton`, error `Alert` (404 → `detail.notFound`, else `detail.loadError`), an info card (`displayName`, active/inactive badge), a contacts card listing each contact's `fullName`/`email`/`phone`/primary badge read-only, or an empty-state line when `contacts.length === 0`.
- `apps/web/src/app/[locale]/(agent)/customers/[id]/page.tsx` — thin wrapper, same shape as `tickets/[id]/page.tsx`.

### 5 — "View customer" navigation

- `ticket-list-view.tsx`: the customer-name cell becomes a link/button to `customers/{ticket.customerId}` alongside the existing displayed name (Design item 5) — the cell's text is unchanged, only made navigable.
- `ticket-detail-view.tsx`: the existing customer-name line gets the same link treatment.

### 6 — i18n

Extend `apps/web/messages/{en,ar}.json` with a `customers.list.*` namespace (title, "new customer" button label already exists under `customers.create.*` from Story 25 — reuse it for the button label; add `error`/`retry`/`empty`/columns) and `customers.detail.*` (contacts heading, empty-contacts line, not-found/load-error, active/inactive labels, "view customer" link label reused across both ticket screens).

### 7 — Tests

`customer-list-view.spec.tsx` and `customer-detail-view.spec.tsx`, mirroring `ticket-list-view.spec.tsx`/`ticket-detail-view.spec.tsx`'s exact mocking conventions (mock `next/navigation`, mock `next-intl` with a key-echoing `t`, mock the new hooks). Extend `ticket-list-view.spec.tsx`/`ticket-detail-view.spec.tsx` only if the new "View customer" link changes any existing assertion (it should not, per Design item 5).

---

## Edge Cases & Failure Modes

- **`GET /customers/:id` 404** (unknown/out-of-branch id): `detail.notFound`, same pattern as `TicketDetailView`.
- **A customer has zero contacts**: contacts card shows an explicit empty-state line, not a blank card.
- **`GET /customers` succeeds with zero customers**: same empty-state paragraph pattern as the Ticket List.
- **An agent without `customer:read`** (not reachable through the seeded `SuperAdmin`; the seeded `Agent` role has zero permissions today, a pre-existing, already-documented observation): the real `403` renders via the existing error-state `Alert`, never assumed to succeed.

---

## Test Plan

1. **Unit/component — `customer-list-view.spec.tsx`**: loading, error+retry, empty, and populated-row rendering with correct navigation on row click.
2. **Unit/component — `customer-detail-view.spec.tsx`**: loading, 404 → not-found message, generic error, populated info + contacts rendering, empty-contacts state.
3. **Regression**: `ticket-list-view.spec.tsx`/`ticket-detail-view.spec.tsx` continue to pass after the "View customer" link addition. Full existing `apps/web` suite otherwise unaffected. `apps/api`/`apps/worker` unaffected (no backend files touched).

---

## Migration / Rollback

None. No Prisma schema or migration change. Rollback is a plain code revert.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; `pnpm typecheck`/`lint`/`build` workspace-wide.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): real `GET /customers`/`GET /customers/:id` calls against the running dev server; confirm the new routes are guarded the same as every other Agent Workspace route.
4. `pnpm --filter @crm/api test:e2e` — regression only, confirms no backend change was required or made.
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, and every protected realtime/SLA/notification file have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] `customers/page.tsx` lists real customers from `GET /customers`, with loading/error/empty states.
- [ ] `customers/[id]/page.tsx` shows a real customer's info and its contacts (read-only) from `GET /customers/:id`, including the 404-vs-generic error distinction.
- [ ] A "View customer" link exists from both the Ticket List and Ticket Detail's existing customer-name display.
- [ ] No customer edit, no contact CRUD, no search/pagination introduced.
- [ ] No new backend endpoint, DTO, permission, Prisma model, migration, realtime event, or SLA behavior.
- [ ] `RealtimeGateway`, `TicketRealtimeListener`, `BranchNotificationRealtimeListener`, `NotificationLog`/its listeners, every SLA-policies file, `schema.prisma`, and migrations remain byte-for-byte unchanged.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass for both new views; existing ticket-view tests remain green.
- [ ] Full existing `apps/web`/`apps/api`/`apps/worker` suites remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
