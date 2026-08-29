# Story 53 — Customer Portal — Submit & Track Own Tickets

## Prerequisites

- `customer-portal-authentication-foundation` Story 52: `Contact` portal auth, `AudienceGuard`/`@PortalRoute()`, `PortalModule`/`PortalService`, `apps/portal`'s login/home screens and `lib/api.ts`.
- `ticketing` Stories 07/08/21: `Ticket`, `TicketsService`, `TicketCreatedEvent`/`TicketHistoryListener`, `TicketHistoryEntry`.

---

## Story Goal

Let an authenticated portal Contact submit a new ticket and see every ticket belonging to their own Customer (not just ones they personally opened — see Design item 1), including each ticket's history. This is the first real, product-facing capability of the Customer Portal beyond authentication, closing the "submit ticket, view and track own tickets, history" line of `docs/architecture/08-supporting-domains.md`.

**Not in scope**: Knowledge Base browsing, CSAT/feedback (both named in the same architecture line, both requiring their own separate design); ticket update/reassignment/status changes from the portal (agent-only); attachments; realtime updates to the portal ticket list (Story 20's `ticket:{id}` room is agent-audience-oriented and out of scope here — see Design item 5); pagination/search (no existing precedent anywhere in this codebase to extend, mirrors `ListTicketsQueryDto`'s own disclosed scope limit).

---

## Context — Read These Files First

1. `apps/api/src/modules/tickets/tickets.service.ts` — `createTicket`/`listTickets`/`getTicket`/`getTicketHistory`/`findTicketInScope`/`toTicketSummary` — the exact patterns this story's new customer-scoped methods mirror, added alongside (not replacing) the existing branch-scoped ones.
2. `apps/api/src/modules/tickets/ticket-history.listener.ts` — confirms `actorUserId` is inserted into `TicketHistoryEntry.actor_user_id`, an FK into `identity.users` — a Contact's id would violate that FK (silently, since the listener catches and logs, never rethrows) — this is why the new `createTicketForContact` must emit `actorUserId: null`, never the Contact's id.
3. `apps/api/src/modules/tickets/tickets.module.ts` — confirms `TicketsService` is already exported, so `PortalModule` can import `TicketsModule` and inject it directly — no new cross-module pattern.
4. `apps/api/src/modules/portal/{portal.module.ts,portal.controller.ts,portal.service.ts}` — the exact `@PortalRoute()`/cookie/DI conventions this story's new controller and service mirror.
5. `apps/api/src/modules/tickets/dto/create-ticket.dto.ts` — the closest DTO precedent; this story's `PortalCreateTicketDto` is a deliberately narrower subset (no `customerId`/`contactId`/`departmentId`/`assignedToUserId`/`priority` — all either auto-derived or agent-only concerns).
6. `apps/web/src/components/customers/customer-detail-view.tsx` — the "Related tickets" card's exact JSX shape (badge-per-status/priority, click-through row) — the template this story's portal ticket-list view mirrors, using plain HTML/Tailwind (Story 52 precedent: `apps/portal` has no shared UI component library).
7. `apps/web/src/components/providers/query-provider.tsx` + `apps/web/src/app/[locale]/layout.tsx` — the exact `QueryClientProvider` setup this story adds to `apps/portal` for the first time (Story 52's screens used plain `fetch`, no TanStack Query yet).

---

## Design decisions

1. **Portal ticket visibility is scoped by Customer, not by individual Contact.** `docs/architecture/08-supporting-domains.md`: "every portal query adds `customerId = currentCustomer.id`... preventing ID-guessing access to another customer's ticket" — this is Customer-level scoping (every contact at a company sees that company's tickets), directly evidenced, not inferred.
2. **New, additive `TicketsService` methods — none of the existing branch-scoped methods are touched.** `createTicketForContact(contactId, dto)`, `listTicketsForCustomer(customerId)`, `getTicketForCustomer(id, customerId)`, `getTicketHistoryForCustomer(id, customerId)`. None of these use `TenantContext` — branch scoping is derived transitively through the Contact→Customer relation instead, so behavior never depends on what a portal-audience JWT's `branchId` claim happens to resolve to (defense in depth, and keeps `TenantContext` exactly what it already is: the agent-audience branch-scoping mechanism).
3. **`actorUserId: null` on the emitted `TICKET_CREATED_EVENT` for a portal submission** (Design item, confirmed via Context item 2) — mirrors `TicketEscalatedEvent`'s existing "no human actor" precedent exactly; never the submitting Contact's id.
4. **`PortalCreateTicketDto` is deliberately narrow**: `subject` (required) and `category` (optional) only. No `priority` (internal triage, defaults to the schema's `MEDIUM`), no `departmentId`/`assignedToUserId` (agent-only routing concerns), no `customerId`/`contactId` (always derived server-side from the authenticated Contact — never client-supplied, per the security rule that child-resource scope is derived from the parent, not a redundant client-controlled field).
5. **No realtime subscription added.** Story 20/21's `ticket:{id}` room and its listener are agent-audience-shaped infrastructure (`RealtimeGateway` rejects non-agent-audience sockets — see `realtime.gateway.ts`); wiring the portal into realtime would need its own room/audience decision, which is a separate, future story's concern, not silently bundled here.
6. **New `PortalTicketsService`** (in `PortalModule`) composes `PortalService.getAuthenticatedContact` (to resolve `customerId` from the JWT's `sub`, reusing its existing portal-access-still-valid check) with the new `TicketsService` customer-scoped methods — keeps `PortalTicketsController` thin and avoids duplicating contact-resolution logic.
7. **First TanStack Query usage in `apps/portal`.** Story 52's screens used plain `fetch` (no data list existed yet). This story adds the same `QueryProvider` (`QueryClientProvider`, `retry: 1`, `refetchOnWindowFocus: false`) `apps/web` already uses, verbatim.
8. **List ordering: `createdAt` descending** (most-recent-first) — a deliberate, disclosed deviation from `TicketsService.listTickets`'s own `createdAt asc` default: a customer-facing "my tickets" view reads naturally newest-first, and this is a new, separate list endpoint, not an extension of the agent one.

---

## Implementation Tasks

### Backend

1. **New `apps/api/src/modules/portal/dto/portal-create-ticket.dto.ts`**:
   ```ts
   export class PortalCreateTicketDto {
     @ApiProperty()
     @IsString()
     @MinLength(1)
     subject!: string;

     @ApiProperty({ required: false })
     @IsOptional()
     @IsString()
     category?: string;
   }
   ```
2. **`apps/api/src/modules/tickets/tickets.service.ts`** — add (do not modify existing methods):
   - `createTicketForContact(contactId: string, dto: PortalCreateTicketDto): Promise<TicketSummary>` — `prisma.contact.findUnique({ where: { id: contactId }, include: { customer: true } })`, 404 if missing; create the `Ticket` with `branchId: contact.customer.branchId`, `customerId: contact.customerId`, `contactId: contact.id`, `subject`, `category: dto.category ?? null`; emit `TICKET_CREATED_EVENT` with `actorUserId: null`.
   - `listTicketsForCustomer(customerId: string): Promise<TicketSummary[]>` — `findMany({ where: { customerId }, orderBy: { createdAt: "desc" } })`.
   - `getTicketForCustomer(id: string, customerId: string): Promise<TicketSummary>` — `findFirst({ where: { id, customerId } })`, 404 otherwise (never distinguishing "wrong customer" from "doesn't exist").
   - `getTicketHistoryForCustomer(id: string, customerId: string): Promise<TicketHistoryEntrySummary[]>` — calls `getTicketForCustomer` first (for the 404/scope check), then the existing `ticketHistoryEntry.findMany` query keyed by `ticketId`.
3. **New `apps/api/src/modules/portal/portal-tickets.service.ts`** — `PortalTicketsService`, injecting `PortalService` + `TicketsService` (see Design item 6).
4. **New `apps/api/src/modules/portal/portal-tickets.controller.ts`** — `@Controller("portal/tickets")`, every route `@PortalRoute()`: `POST /`, `GET /`, `GET /:id`, `GET /:id/history`.
5. **`apps/api/src/modules/portal/portal.module.ts`** — `imports: [AuthModule, TicketsModule]`, add `PortalTicketsController` to `controllers`, `PortalTicketsService` to `providers`.
6. **Tests** — see Test Plan.

### Frontend (`apps/portal`)

7. **`apps/portal/src/components/providers/query-provider.tsx`** — mirrors `apps/web`'s file verbatim.
8. **`apps/portal/src/app/[locale]/layout.tsx`** — wrap `children` in `<QueryProvider>`, mirroring `apps/web`'s nesting.
9. **`apps/portal/src/lib/tickets-api.ts`** — `PortalTicketSummary`, `PortalTicketHistoryEntry`, `listMyTickets`/`getMyTicket`/`getMyTicketHistory`/`createMyTicket`, all via the existing `apiFetch` from `lib/api.ts`.
10. **`apps/portal/src/hooks/use-portal-tickets.ts`** — `useMyTicketsQuery`, `useMyTicketQuery`, `useMyTicketHistoryQuery`, `useCreateMyTicketMutation` — mirrors `apps/web/src/hooks/use-tickets.ts`'s never-optimistic convention.
11. **`apps/portal/src/app/[locale]/(customer)/tickets/page.tsx`** — the "My Tickets" list (loading/error/empty/populated, mirrors `CustomerDetailView`'s related-tickets card shape) + an inline "submit a ticket" form (mirrors Story 52's own inline-form precedent).
12. **`apps/portal/src/app/[locale]/(customer)/tickets/[id]/page.tsx`** — ticket detail (subject/category/priority/status) + its history list, mirroring `TicketDetailView`'s history card shape.
13. **`apps/portal/src/components/portal/portal-header.tsx`** — add a nav link to `/tickets` (the portal's first real nav item beyond sign-out).
14. **i18n** — new `apps/portal` `tickets` namespace (list/create/detail/history keys), both locales; `home` page gets a link into `/tickets` too.
15. **Tests** — see Test Plan.

---

## API contract

- `POST /portal/tickets` — `@PortalRoute()` — body `{ subject, category? }` — returns `TicketSummary`; 400 for an empty subject.
- `GET /portal/tickets` — `@PortalRoute()` — returns `TicketSummary[]` for the caller's Customer, `createdAt` desc, `[]` if none.
- `GET /portal/tickets/:id` — `@PortalRoute()` — returns `TicketSummary`; 404 for a ticket belonging to a different Customer or nonexistent.
- `GET /portal/tickets/:id/history` — `@PortalRoute()` — returns `TicketHistoryEntrySummary[]`, `createdAt` asc, `[]` if none; same 404 rule.
- All four reject an `agent`-audience token with 401 (via the existing `AudienceGuard`, unchanged).

## Authorization / tenant-scoping rules

Every route requires a valid `customer`-audience token (`AudienceGuard`, unchanged from Story 52). Scope is Customer-level, derived server-side from the authenticated Contact's `customerId` — never client-supplied. No RBAC/permission check applies (Contacts have no role system, consistent with Story 52).

## Tests

**Backend unit** (extend `apps/api/src/modules/tickets/tickets.service.spec.ts`):
- `createTicketForContact`: creates with the contact's own customerId/contactId/branchId; 404 for an unknown contact; emits `TICKET_CREATED_EVENT` with `actorUserId: null`.
- `listTicketsForCustomer`: scopes by customerId, orders `createdAt desc`, returns `[]` for none.
- `getTicketForCustomer`/`getTicketHistoryForCustomer`: 404 for a ticket belonging to a different customer or unknown id.

**Backend unit** (new `apps/api/src/modules/portal/portal-tickets.service.spec.ts`): mocked `PortalService`/`TicketsService`, verifies the customerId-resolution delegation.

**Backend e2e** (new `apps/api/test/portal-tickets.e2e-spec.ts`, reusing Story 52's Contact/portal-password fixture pattern): 401 for all four routes without a token; 401 for an agent-audience token; full create → list → get → history lifecycle; 404 for a ticket belonging to a different customer (create a second Customer/Contact fixture); 400 for an empty subject.

**Frontend component** (`apps/portal`): loading/error/empty/populated states for the ticket list; the inline create-ticket form (disabled-until-non-empty, exact payload, success clears the field, backend-message-or-fallback on failure); ticket detail + history rendering.

## Regression requirements

Every existing backend/frontend test suite remains green, unweakened — especially `tickets.service.spec.ts` (only additive methods) and every Story 52 portal test.

## Migration requirements

None — no schema change. `Ticket`/`TicketHistoryEntry` already exist; this story only adds new query/creation methods over them.

## Edge cases

- A Customer with zero tickets → `[]`, not a 404.
- A ticket created by an agent (not via the portal) for this Customer → still visible in the portal list (scoping is by `customerId`, not by "submitted via portal").
- Two contacts at the same Customer → both see the same ticket list (Design item 1).

## Security risks/mitigations

- **Cross-customer leak prevention**: identical `findFirst({ id, customerId })` 404-masking pattern as every other scoped resource in this codebase.
- **No client-controlled scope fields**: `customerId`/`contactId`/`branchId` are never accepted from the portal request body — always derived from the authenticated JWT's `sub` server-side.
- **No new privilege surface**: reuses the existing `customer`-audience `AudienceGuard` check from Story 52; no RBAC permission key involved (none exists for Contacts).

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `TicketsService` gains four new, additive, customer/contact-scoped methods; no existing method changed.
- [ ] `POST/GET /portal/tickets` and `GET /portal/tickets/:id[/history]` exist, gated by `@PortalRoute()`.
- [ ] A portal-submitted ticket's `TICKET_CREATED_EVENT`/history entry has `actorUserId: null`, never the Contact's id.
- [ ] `apps/portal` has a real "My Tickets" list + submit form + ticket detail/history view, TanStack-Query-backed.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Knowledge Base browsing, CSAT/feedback in the portal.
- Ticket update/status/reassignment from the portal.
- Realtime updates to the portal ticket list.
- Pagination/search.
- Any README change.

---

## Dependencies

See Prerequisites. Hard sequencing: `TicketsService` additive methods → `PortalTicketsService`/controller → `apps/portal` TanStack Query wiring → screens.
