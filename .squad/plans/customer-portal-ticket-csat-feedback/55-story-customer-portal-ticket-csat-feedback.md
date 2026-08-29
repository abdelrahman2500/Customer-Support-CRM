# Story 55 — Customer Portal — Ticket CSAT / Feedback

## Prerequisites

- `ticketing` Story 50: `TicketNote` — the exact structural precedent (ticket-scoped child model, `ticketing` schema, cascade-deleted, single `ticketId` index) this story's new `TicketCsatResponse` model mirrors.
- `customer-portal-ticket-submission-tracking` Story 53: `PortalTicketsService`/`PortalTicketsController`, `TicketsService`'s customer-scoped methods (`getTicketForCustomer`, `findTicketInCustomerScope`).

---

## Story Goal

Let a portal Contact submit a one-time satisfaction rating (1–5) and optional comment on their own Customer's ticket, once it is `RESOLVED` or `CLOSED` — closing the last named Customer Portal capability (`docs/architecture/08-supporting-domains.md`: "submit ticket, view and track own tickets, history, Knowledge Base browsing, and CSAT/feedback capabilities" — the first four are done as of Stories 53–54). Agents can see the submitted feedback (read-only) on Ticket Detail.

**Not in scope**: CSAT aggregation/reporting (Reporting & Analytics' own future, separate domain); editing or deleting a submitted response (append-only, mirrors `TicketNote`); CSAT surveys/reminders/notifications; any customer-facing prompt-to-rate UI beyond the ticket detail screen itself.

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `Ticket`/`TicketNote` (the exact model shape to mirror, including cascade/index conventions) and the `TicketStatus` enum (`OPEN`/`IN_PROGRESS`/`RESOLVED`/`CLOSED` — feedback is only accepted for the latter two).
2. `apps/api/src/modules/tickets/tickets.service.ts` — `findTicketInCustomerScope` (Story 53) and `createTicketNote`/`getTicketNotes` (Story 50) — the exact patterns this story's new methods mirror.
3. `apps/api/src/modules/portal/portal-tickets.{controller,service}.ts` — the exact `@PortalRoute()`/contact-resolution pattern this story's new routes extend (added to the same controller/service, not a new one).
4. `apps/api/src/modules/tickets/tickets.controller.ts` — the exact `GET :id/history` (`ticket:read`) precedent this story's new agent-facing `GET :id/csat` route mirrors (same permission, no new key).
5. `apps/portal/src/components/tickets/ticket-detail-view.tsx` — the exact card shape (loading/error/populated) this story's new CSAT section extends.
6. `apps/web/src/components/tickets/ticket-detail-view.tsx` — the exact "append a new card after History" convention (Story 49/50) this story's new read-only "Customer Satisfaction" card follows.

---

## Design decisions

1. **New `TicketCsatResponse` model, mirroring `TicketNote` almost exactly**, with one deliberate difference: `submittedByContactId` (FK to `Contact`, required) instead of an agent `authorUserId` — a CSAT response can only ever come from a portal Contact, never an agent. `@@unique([ticketId])` — exactly one response per ticket (first submission locks it; a second attempt is `409 Conflict`), the same "one row, immutable" shape `SlaTicketTarget` already established for a strict 1:1-with-Ticket relation.
2. **Feedback is only accepted once the ticket is `RESOLVED` or `CLOSED`** — `400 Bad Request` otherwise. Enforced in the service, not the DB (no DB-level check constraint exists elsewhere in this schema for a status-conditional rule, so this isn't a new precedent to introduce).
3. **Permission: reuse `ticket:read`** for the agent-facing `GET :id/csat` route — mirrors `GET :id/history`'s exact precedent. No portal RBAC involved (Contacts have no role system, Story 52's own precedent).
4. **Rating is a plain `Int` (1–5), not an enum** — mirrors `SlaPolicy.responseTargetMinutes`'s "plain scalar, no lookup table" precedent; validated at the DTO layer (`@Min(1) @Max(5)`), not the DB (no CHECK constraint exists elsewhere in this schema to extend).
5. **Added to the existing `PortalTicketsController`/`PortalTicketsService`**, not a new module — CSAT is conceptually part of "my ticket," the same reasoning that kept Story 50's `TicketNote` inside `TicketsController` rather than a new controller.
6. **Agent Workspace gets a new, read-only "Customer Satisfaction" card**, appended after History (Story 49/50's established append point) — never editable by an agent.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`**:
   - Add `csatResponse TicketCsatResponse?` to `Ticket`.
   - Add `csatResponses TicketCsatResponse[]` to `Contact`.
   - Add:
     ```prisma
     /// One-time customer satisfaction rating on a Ticket, submitted only via
     /// the Customer Portal once the ticket is RESOLVED or CLOSED — see
     /// docs/architecture/08-supporting-domains.md ("CSAT/feedback").
     /// Mirrors `TicketNote` (Story 50) exactly except `submittedByContactId`
     /// is a Contact, never an agent User — a CSAT response can only ever
     /// come from a portal Contact. `@@unique([ticketId])`: exactly one
     /// response per ticket, immutable once created (append-only, no
     /// update/delete route, same convention as `TicketNote`).
     model TicketCsatResponse {
       id                   String   @id @default(uuid())
       ticketId             String   @unique @map("ticket_id")
       ticket               Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
       submittedByContactId String   @map("submitted_by_contact_id")
       submittedByContact   Contact  @relation(fields: [submittedByContactId], references: [id])
       rating               Int
       comment              String?
       createdAt            DateTime @default(now()) @map("created_at")

       @@map("ticket_csat_responses")
       @@schema("ticketing")
     }
     ```
2. **Migration** — generated via `prisma migrate dev` against the real local Postgres.
3. **New `apps/api/src/modules/portal/dto/submit-csat.dto.ts`**: `rating` (`@IsInt() @Min(1) @Max(5)`), `comment?` (`@IsOptional() @IsString()`).
4. **`apps/api/src/modules/tickets/tickets.service.ts`** — add (additive only):
   - `TicketCsatSummary` interface (`id`, `ticketId`, `submittedByContactId`, `rating`, `comment`, `createdAt`).
   - `submitCsatForCustomer(ticketId, customerId, contactId, dto)`: `findTicketInCustomerScope` (404 if not this customer's ticket); `400` if `status` isn't `RESOLVED`/`CLOSED`; `409` (via Prisma's `P2002` on the ticket create, translated) if one already exists; creates the row.
   - `getCsatForCustomer(ticketId, customerId): Promise<TicketCsatSummary | null>` — `findTicketInCustomerScope` then `findUnique({ where: { ticketId } })`, `null` if none (not an error).
   - `getCsatForTicket(id): Promise<TicketCsatSummary | null>` — agent-facing, `findTicketInScope` then the same `findUnique`, `null` if none.
5. **`apps/api/src/modules/tickets/tickets.controller.ts`** — add `GET :id/csat` (`ticket:read`).
6. **`apps/api/src/modules/portal/portal-tickets.service.ts`** — add `submitCsat`/`getCsat`, resolving `customerId` via `PortalService.getAuthenticatedContact` exactly like the existing methods.
7. **`apps/api/src/modules/portal/portal-tickets.controller.ts`** — add `POST :id/csat` / `GET :id/csat`, both `@PortalRoute()`.
8. **Tests** — see Test Plan.

### Frontend

9. **`apps/portal/src/lib/tickets-api.ts`** — `PortalCsatSummary`, `getMyTicketCsat`, `submitMyTicketCsat`.
10. **`apps/portal/src/hooks/use-portal-tickets.ts`** — `useMyTicketCsatQuery`, `useSubmitMyTicketCsatMutation`.
11. **`apps/portal/src/components/tickets/ticket-detail-view.tsx`** — a new CSAT section, shown only when `status` is `RESOLVED`/`CLOSED`: the existing response (read-only) if present, else a rating (1–5) + comment submit form.
12. **`apps/web/src/lib/tickets-api.ts`** / **`apps/web/src/hooks/use-tickets.ts`** — `TicketCsat`, `getTicketCsat`, `useTicketCsatQuery` (read-only, mirrors `useTicketEscalationsQuery`).
13. **`apps/web/src/components/tickets/ticket-detail-view.tsx`** — a new, read-only "Customer Satisfaction" card, appended after History.
14. **i18n** — new keys in both `apps/portal` (`tickets.detail.csat*`) and `apps/web` (`tickets.detail.csat*`), both locales.
15. **Tests** — see Test Plan.

---

## API contract

- `POST /portal/tickets/:id/csat` — `@PortalRoute()` — body `{ rating, comment? }` — 400 if the ticket isn't `RESOLVED`/`CLOSED`; 404 for a different customer's/unknown ticket; 409 if feedback already exists.
- `GET /portal/tickets/:id/csat` — `@PortalRoute()` — returns the response or `null`; same 404 rule.
- `GET /tickets/:id/csat` — `ticket:read` — returns the response or `null`; 404 for out-of-branch/unknown.

## Tests

**Backend unit** (extend `tickets.service.spec.ts`): `submitCsatForCustomer` — 404 wrong customer, 400 wrong status, 409 duplicate, success path; `getCsatForCustomer`/`getCsatForTicket` — null-when-none, 404 wrong scope.

**Backend unit** (extend `portal-tickets.service.spec.ts`): delegation shape for the two new methods.

**Backend e2e** (extend `portal-tickets.e2e-spec.ts` and `tickets.e2e-spec.ts`): 400 on an OPEN ticket; success once resolved; 409 on a second submission; agent sees it via `GET /tickets/:id/csat`; cross-customer 404.

**Frontend component** (both apps): the RESOLVED/CLOSED-only visibility rule; submit form (disabled until a rating is chosen); read-only display once submitted.

## Regression requirements

Every existing test suite remains green, unweakened.

## Migration requirements

One migration: new `ticket_csat_responses` table. No existing table altered.

## Security risks/mitigations

- **Cross-customer leak prevention**: identical `findTicketInCustomerScope` mechanism as every other portal ticket route.
- **No RBAC surface change**: agent read reuses `ticket:read`; no new permission key.
- **Status gate prevents premature/duplicate feedback**: enforced server-side, not just hidden in the UI.

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

- [ ] `TicketCsatResponse` exists, migration applied; append-only (no update/delete route).
- [ ] Portal submit/read + agent read-only routes exist, permission-correct.
- [ ] Feedback only accepted on a `RESOLVED`/`CLOSED` ticket, exactly once.
- [ ] Both frontends show the CSAT card correctly (submit form / read-only display / hidden-until-resolved).
- [ ] Both locales translated for every new string, both apps.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- CSAT aggregation/reporting; edit/delete of a submitted response; survey reminders/notifications.
- Any README change.
