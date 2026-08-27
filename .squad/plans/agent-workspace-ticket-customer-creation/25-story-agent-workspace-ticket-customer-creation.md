# Story 25 — Agent Workspace: Ticket & Customer Creation

## Prerequisites

- `customer-management` Story 06 completed: `POST /customers` (`CustomersController.create`/`CustomersService.createCustomer`/`CreateCustomerDto` — `{ displayName }` only, `branchId` stamped from `TenantContext`, never client-supplied). Not modified by this story.
- `ticketing` Stories 07–09 completed: `POST /tickets` (`TicketsController.create`/`TicketsService.createTicket`/`CreateTicketDto` — `{ customerId, subject, category?, priority?, contactId?, departmentId?, assignedToUserId? }`, with `requireDepartmentInScope`/`requireUserInScope` guards and a `NotFoundException` for an out-of-branch `customerId`/`contactId`). Not modified by this story.
- `agent-workspace-ticket-operations-mvp` Story 23 completed: the authenticated `(agent)/layout.tsx` shell, `apps/web/src/lib/tickets-api.ts` (`apiFetch`/`ApiError`), `apps/web/src/hooks/use-tickets.ts` (query/mutation conventions), `apps/web/src/components/ui/**` (`Input`, `Select`, `Button`, `Alert`, `Skeleton`), and the `tickets`/`tickets/[id]` routing convention. Not modified except the additive extensions this plan names explicitly.
- The intake this plan was generated from (`.squad/stories/agent-workspace-ticket-customer-creation/agent-workspace-ticket-customer-creation/intake.md`) records the three presentation-level decisions already resolved (customer picker via the existing full list, two independent flows, dedicated routes) — this plan does not revisit them.

---

## Story Goal

Let an authenticated agent create a customer and create a ticket (for an existing customer) from the Agent Workspace, using exactly the existing `POST /customers`/`POST /tickets` contracts. This closes the one remaining "view/manage but not originate" gap in the workspace, without inventing any backend capability.

**Not in scope** (per the intake's explicit "Out of scope" list): customer search/autocomplete backend, pagination, bulk import, bulk ticket creation, attachments, ticket comments, rich text editing, contact creation, department/assignment selection at creation time, Customer Portal, Channels, Integrations, AI, Reporting, Administration, `AutomationRule`, Agent Presence, ticket unassignment-to-`null`, any new realtime event/room, any new SLA behavior, any backend contract change.

---

## Context — Read These Files First

1. `apps/api/src/modules/customers/dto/create-customer.dto.ts` (9 lines, read in full) — `{ displayName: string }`, `@MinLength(1)`. This is the entire contract; nothing else is accepted or required.
2. `apps/api/src/modules/customers/customers.controller.ts` / `.service.ts` (read in full) — `POST /customers` (`customer:create`), `branchId` always stamped from `TenantContext`, never from the request body. `GET /customers` (`customer:read`) returns `CustomerSummary[]` (`{ id, displayName, isActive }`), already consumed by `apps/web/src/hooks/use-tickets.ts`'s `useCustomersQuery()`.
3. `apps/api/src/modules/tickets/dto/create-ticket.dto.ts` (read in full) — `customerId` (required, UUID), `subject` (required, `@MinLength(1)`), `category`/`priority` optional, `contactId`/`departmentId`/`assignedToUserId` optional. This story's form submits only `customerId`, `subject`, and optionally `category`/`priority` — the other three stay omitted (Design item 3).
4. `apps/api/test/customers.e2e-spec.ts` line ~65 (`creates a customer as the admin`) and `apps/api/test/tickets.e2e-spec.ts` lines 121–176 (the full set of creation-related e2e cases: unknown `customerId`/`contactId`/`departmentId`/`assignedToUserId` → 404, empty `subject` → validation error, successful creation defaulting status/priority) — confirms every failure mode this story's UI needs to handle is already a real, tested backend behavior; nothing new to anticipate.
5. `apps/web/src/lib/tickets-api.ts` (whole file, read in full) — `apiFetch<T>`, `ApiError` (carries real HTTP `status`), `listCustomers()`. This story adds `createCustomer`/`createTicket` client functions here, following the exact same shape as the existing `updateTicket`.
6. `apps/web/src/hooks/use-tickets.ts` (whole file, read in full) — `useCustomersQuery()` (already fetches the full branch customer list, 5-minute `staleTime`, exactly what Design item 1 reuses for the picker), and `useUpdateTicketMutation`'s "never optimistic, invalidate on success only" convention, which this story's two new mutations mirror.
7. `apps/web/src/components/tickets/ticket-list-view.tsx` (whole file, read in full) — the `FilterSelect` pattern (a `Select` driven by a full in-memory list) is the direct precedent for this story's customer picker; the loading/error/empty JSX conventions (`Skeleton`, `Alert` + retry, `Table`) are the precedent for this story's form loading/error states.
8. `apps/web/src/app/[locale]/(auth)/login/page.tsx` (Story 23, read in full) — the only existing "form" in the codebase: plain `useState` per field, HTML5 `required`, a `try/catch` around the submit call, an `Alert` for the failure message. This story's two forms follow the identical shape — **no form/validation library is introduced** (none exists in `apps/web/package.json` today, confirmed by inspection).
9. `apps/web/src/app/[locale]/(agent)/tickets/page.tsx` / `tickets/[id]/page.tsx` (Story 23, read in full) — the exact thin-route-wrapping-a-client-component convention this story's two new routes (`tickets/new`, `customers/new`) follow.
10. `apps/web/package.json` — confirms `@radix-ui/react-dialog` is an installed-but-never-used dependency (Story 23). This story does **not** activate it — Design item 3 uses dedicated routes, not a dialog, so no new UI primitive is built around it.

---

## Design (resolved during this planning pass, per the intake's explicit delegation)

1. **Customer selection for ticket creation reuses the existing full `GET /customers` list in a `Select` — no new backend capability.** `CustomersController` has no query parameters of any kind (confirmed by inspection: `list()` takes none). Building search/autocomplete would mean inventing a first-of-its-kind contract, exactly what Story 23's own plan already declined to do for the ticket list itself. `useCustomersQuery()` (Context item 6) already fetches the full branch customer list for name-resolution elsewhere in the workspace — this story's `CreateTicketView` reuses the *same* query (same cache entry, no extra request) and renders it as a `Select`, mirroring `TicketListView`'s own `FilterSelect`/assigned-agent-picker pattern (Context item 7). This scales exactly as well (or as poorly) as the rest of the workspace does today — a known, already-accepted limitation, not a new one.
2. **Customer creation and ticket creation are two independent routes/flows, not a combined one.** The two backend endpoints are entirely independent (no combined endpoint exists, and Design item 1 of Story 06's own plan never anticipated one). A combined flow would require inventing cross-entity error handling (what happens if the customer POST succeeds but the ticket POST fails?) that no existing pattern in this codebase covers. Keeping them separate is strictly additive and mirrors the backend's own boundary.
3. **`CreateTicketView` submits only `customerId`, `subject`, `category?`, `priority?`.** `contactId`/`departmentId`/`assignedToUserId` are left omitted (not merely hidden — never sent), consistent with the intake's explicit deferral of contact creation and department/assignment-at-creation-time. All three remain editable afterward through Story 23's existing ticket-detail actions (`assignedToUserId`) or are simply not needed for an MVP creation flow (`departmentId`) — `contactId` has no creation UI anywhere yet (Contacts were never given a workspace UI in Story 23 either) and inventing one is explicitly out of scope here.
4. **Dedicated routes (`tickets/new`, `customers/new`), not a modal/dialog.** Story 23 established dedicated routes for every workspace screen; no modal/dialog exists anywhere in `apps/web` today despite `@radix-ui/react-dialog` being installed (Context item 10). Building a `Dialog` UI primitive purely to house a first, simple two-field/four-field form would be more new surface area than the smallest-coherent-approach standard calls for. `tickets/new` and `customers/new` slot directly into the existing `(agent)/tickets/` and a new sibling `(agent)/customers/` segment, following the exact `page.tsx`-wraps-a-client-component shape Context item 9 already established.
5. **No form/validation library.** None exists in `apps/web/package.json` (confirmed by inspection) and the one existing form in this codebase (the login page, Context item 8) uses plain `useState` + HTML5 `required` + a `try/catch`. Both new forms follow that identical shape — introducing `react-hook-form`/`zod`/etc. for two small forms would be new dependency surface the intake's own "do not introduce... unless genuinely required" rule forbids without justification, and none exists: the backend DTOs are simple enough (1–3 required fields) that manual state is not a burden.
6. **Never optimistic; TanStack Query `useMutation`, invalidate-on-success only.** Mirrors `useUpdateTicketMutation` (Context item 6) exactly: the mutation's `mutationFn` calls the real endpoint; only a successful response triggers `queryClient.invalidateQueries(["customers"])` / `["tickets"]` (and, for ticket creation, navigation to the new ticket's real detail page, which then fetches its own real state — never a client-constructed optimistic ticket object).
7. **Errors render inline via the existing `Alert` component, keyed off `ApiError.status` where it matters** (e.g., a validation `400` renders the backend's own message; any other status renders a generic fallback) — the same pattern `TicketDetailView`'s action-mutation error handling already uses.

---

## Implementation Tasks

### 1 — API client functions

File: `apps/web/src/lib/tickets-api.ts`

Add:
```ts
export interface CreateCustomerInput {
  displayName: string;
}

export function createCustomer(input: CreateCustomerInput): Promise<CustomerSummary> {
  return apiFetch<CustomerSummary>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface CreateTicketInput {
  customerId: string;
  subject: string;
  category?: string;
  priority?: TicketPriority;
}

export function createTicket(input: CreateTicketInput): Promise<TicketSummary> {
  return apiFetch<TicketSummary>("/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

### 2 — Query hooks / mutations

File: `apps/web/src/hooks/use-tickets.ts`

Add `useCreateCustomerMutation()` (invalidates `["customers"]` on success) and `useCreateTicketMutation()` (invalidates `["tickets"]` on success) — both plain `useMutation` wrappers, no optimistic update, matching `useUpdateTicketMutation`'s shape (Design item 6).

### 3 — `CreateCustomerView` + route

New files:
- `apps/web/src/components/customers/create-customer-view.tsx` — a client component: one `Input` (`displayName`, `required`), submit via `useCreateCustomerMutation`, inline `Alert` on error, on success navigate to the customer's... (this story does not build a customer-detail route — Story 23 never built one). On success, navigate back to `tickets/new` if arrived from there via a `?returnTo=` style flow is out of scope complexity; the minimum viable, non-inventing behavior is: on success, show a success `Alert` with the new customer's `displayName` and a link to `tickets/new` (so the agent can immediately create a ticket for the customer they just created) and clear the form for creating another. No new "customer detail" page is invented.
- `apps/web/src/app/[locale]/(agent)/customers/new/page.tsx` — thin wrapper rendering `CreateCustomerView`, mirroring `tickets/page.tsx`'s shape.

### 4 — `CreateTicketView` + route

New files:
- `apps/web/src/components/tickets/create-ticket-view.tsx` — a client component: a `Select` for `customerId` (options from `useCustomersQuery()`, Design item 1), an `Input` for `subject` (required), an `Input` for `category` (optional), a `Select` for `priority` (optional, defaulting to the backend's own default by simply omitting the field when unset — never invents a default client-side). Submits via `useCreateTicketMutation`; on success, `router.push`'s to the real `tickets/{id}` detail route (Design item 6); on error, inline `Alert` (Design item 7). Includes a link to `customers/new` for the case where the agent needs to create a customer first.
- `apps/web/src/app/[locale]/(agent)/tickets/new/page.tsx` — thin wrapper rendering `CreateTicketView`.

### 5 — Navigation entry points

File: `apps/web/src/components/tickets/ticket-list-view.tsx` — add a `Button`/link to `tickets/new` near the list's title (the only existing screen an agent would naturally look for "create" on). No other navigation surface is invented (e.g., no new nav-bar-level "Create" menu — `WorkspaceNav` is not modified).

### 6 — i18n

Extend `apps/web/messages/{en,ar}.json` with a `customers` namespace (title, `displayName` label, submit/cancel labels, success/error messages) and additions to the existing `tickets` namespace (`list.createButton`, `create.*` for the new-ticket form's labels/errors) — following the exact structure/tone of the existing `tickets`/`auth` namespaces.

### 7 — Tests

Unit/component tests for `CreateCustomerView` and `CreateTicketView`, mirroring `ticket-detail-view.spec.tsx`'s mocking conventions (mock `next/navigation`, mock `next-intl` with a key-echoing `t`, mock the new hooks) — see Test Plan.

---

## Edge Cases & Failure Modes

- **`POST /customers` rejects with a `400`** (empty `displayName`): the existing global `ValidationPipe` produces this before the controller runs; the form's `Alert` renders the backend's own validation message via `ApiError.message`. HTML5 `required` prevents the common case client-side first, matching the login page's own layered approach.
- **`POST /tickets` rejects with `404`** (a `customerId` that is somehow no longer in scope — e.g. a race with another agent deactivating it): surfaced the same inline way; not specially handled, since `ApiError` already carries the real status/message and the existing `Alert` pattern already covers "backend rejected this."
- **The customer list (`useCustomersQuery`) is still loading when `CreateTicketView` mounts**: the `Select` renders disabled/empty until data arrives (mirrors `TicketListView`'s existing `FilterSelect` behavior with an empty `options` array — no new loading-state convention invented).
- **An agent without `customer:create`/`ticket:create` attempts to submit** (not reachable through the seeded `SuperAdmin`, but the seeded `Agent` role has zero permissions today, per Story 23's own documented, pre-existing observation): the real backend `403` is surfaced inline, exactly like every other mutation in this workspace — never assumed to succeed, never hidden.
- **Double-submit** (agent clicks submit twice quickly): `useMutation`'s own `isPending` state disables the submit button while a request is in flight, the same guard pattern already implicit in `TicketDetailView`'s Select-driven mutations (a mutation already in flight is not re-triggered by the same control).

---

## Test Plan

1. **Unit/component — `create-customer-view.spec.tsx`** (new): renders the form; empty submit is blocked by `required`; successful submission calls the mocked mutation with `{ displayName }` and shows a success state; a mocked `ApiError` renders inline; English and Arabic message rendering via a real `NextIntlClientProvider` + real message catalogs (mirroring `notification-toaster.spec.tsx`'s precedent for genuine EN/AR assertions, not just mocked keys).
2. **Unit/component — `create-ticket-view.spec.tsx`** (new): renders with a mocked customer list in the picker; empty/invalid submit is blocked; successful submission calls the mocked mutation with the expected payload shape (confirms `contactId`/`departmentId`/`assignedToUserId` are never sent, per Design item 3) and navigates to `tickets/{new-id}`; a mocked `ApiError` renders inline; English and Arabic rendering.
3. **Unit — the two new hooks** (`useCreateCustomerMutation`/`useCreateTicketMutation`), if not already fully exercised by the component tests above: confirm invalidation of `["customers"]`/`["tickets"]` on success only, never on error.
4. **Regression:** full existing `apps/web` suite (in particular `ticket-list-view.spec.tsx` after its new "create" link is added, and every Story 24 notification test) must remain unaffected. Full existing `apps/api`/`apps/worker` suites are unaffected (no backend file changes) — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change of any kind — this story only adds frontend files consuming already-existing, already-tested endpoints. Rollback is a plain code revert.

---

## Verification Steps

1. **Frontend builds:** `pnpm --filter @crm/web typecheck`, `lint`, `build`.
2. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build`.
3. **Unit tests:** `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only — no backend files touched).
4. **Live infra (if available):** confirm real `POST /customers`/`POST /tickets` calls from the running dev server succeed with the exact payload shapes this story sends, and that a real backend rejection (e.g. an intentionally invalid payload) renders inline rather than being swallowed.
5. **E2E (if live infra available):** `pnpm --filter @crm/api test:e2e` — regression only, confirms this story did not require and did not make any backend change.
6. **Hygiene:** `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, and every protected realtime/SLA/notification file have empty diffs.
7. **Browser/DOM verification:** explicitly not claimed unless an actual browser automation capability is available in the executing session — real API verification and unit/component test verification are reported separately from any DOM-level claim.

## Done Criteria

- [ ] An agent can create a customer via `customers/new`, using only the existing `POST /customers` contract.
- [ ] An agent can create a ticket via `tickets/new`, selecting an existing customer from the existing `GET /customers` list, using only the existing `POST /tickets` contract.
- [ ] A successful ticket creation navigates to the new ticket's real detail page; the ticket list reflects it via existing query invalidation.
- [ ] A successful customer creation is surfaced (not silently discarded) and links onward to ticket creation.
- [ ] Every failure mode (validation, `404`, `403`) is shown inline, never optimistic, never swallowed.
- [ ] No new backend endpoint, DTO, permission, Prisma model, migration, realtime event, or SLA behavior.
- [ ] `RealtimeGateway`, `TicketRealtimeListener`, `BranchNotificationRealtimeListener`, `NotificationLog`/its listeners, every SLA-policies file, `schema.prisma`, and migrations remain byte-for-byte unchanged.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass for both new views.
- [ ] Full existing `apps/web`/`apps/api`/`apps/worker` suites remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
