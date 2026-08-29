# Story 50 — Agent Workspace: Ticket Internal Notes (Agent-Only)

## Prerequisites

- `ticketing` Story 07/09: the `Ticket` model, `TicketsService`/`TicketsController`, and `TicketHistoryEntry` — the exact structural precedent (ticket-scoped child model, `ticketing` schema, cascade-deleted, single `ticketId` index) this story's new `TicketNote` model mirrors.
- `agent-workspace-customer-editing` Story 30: `createContact`'s precedent of reusing the parent domain's existing `create` permission (`customer:create`) for a child-resource creation, rather than minting a new one — the exact precedent this story's permission decision follows.
- `realtime-socketio-foundation` Story 20 / `ticket-history-timeline-completion` Story 21: the `ticket:{id}` realtime room and `TicketRealtimeListener`'s event-agnostic `relay()` mechanism, extended here with one new handler.
- `agent-workspace-sla-escalation-visibility` Story 49: the most recently-added Ticket Detail card (`useTicketEscalationsQuery`, its exact JSX shape) — the direct structural template this story's Notes card mirrors.

---

## Story Goal

Let an agent add a free-text, agent-only note to a ticket, and see all of a ticket's existing notes in chronological order, with new notes appearing in real time to any other agent already viewing the same ticket — via the already-existing `ticket:{id}` room. This closes the single largest gap the Project Completion Audit identified in the already-built core: today, an agent has no way to record context, handoff notes, or investigation findings on a ticket.

**Not in scope**: anything customer-visible, customer-authored, or externally sourced; any `channel`/`source`/`externalRef` field or concept; the Communication/Channels domain, the Integration Hub, or a `ChannelsModule` in any form; email/WhatsApp/SMS/live-chat/web-form integration; AI-generated replies; attachments on notes; editing or deleting an existing note; ticket pagination/search; `Contact.isActive`; notification read/unread state; the `createUser` foreign-key validation gap; the dead `agent:{id}:presence` realtime room; Knowledge Base; Reporting; Customer Portal; Integrations; the generic `AutomationRule` engine. This story is honestly modeled as **Ticket → Internal Notes**, not **Ticket → Messages → internal/customer/channel variants** — no generalized "message" abstraction is introduced merely because Channels will eventually need one.

---

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `Ticket` (lines 260-288, no `notes`/`TicketNote[]` relation yet — this story adds one) and `TicketHistoryEntry` (lines 290-309, the exact model shape to mirror, including its doc comment's citation of `docs/architecture/03-domain-boundaries.md`).
2. `apps/api/src/modules/tickets/tickets.controller.ts` — the exact route/permission pattern (`GET :id/history` reuses `ticket:read`, no class-level doc comment exists on this file today).
3. `apps/api/src/modules/tickets/tickets.service.ts` — `findTicketInScope` (lines 232-251) and `getTicketHistory` (lines 213-226), the exact scoping+query pattern `getTicketNotes`/`createTicketNote` mirror; the class doc comment (lines 52-69) citing `docs/architecture/03-domain-boundaries.md` and Story 07's "CASL-based per-record visibility... explicitly deferred" note.
4. `apps/api/src/modules/tickets/tickets.events.ts` — the exact `TICKET_X_EVENT` constant + `TicketXEvent` interface convention (all four existing events share `{ ticket: TicketSummary; actorUserId: string | null }` — this story's new event deliberately deviates, see Design item 6).
5. `apps/api/src/realtime/ticket-realtime.listener.ts` + its spec — the exact `relay(eventName, ticketId, payload)` mechanism (already event-name/payload-agnostic) and its test's mock-gateway/assertion shape.
6. `apps/api/src/modules/customers/contacts.controller.ts` (or wherever `POST /customers/:id/contacts` is defined) — confirm the exact `customer:create` reuse for a child-resource creation, the direct precedent for this story's permission decision.
7. `apps/api/test/tickets.e2e-spec.ts` — its self-contained bootstrap (creates its own Customer/Contact/Ticket fixtures via real HTTP calls, captures `ticketId` in a closure variable reused across the file) and its exact 401/403 test recipe (create-Agent-user → login → expect 403, repeated per route).
8. `apps/web/src/components/tickets/ticket-detail-view.tsx` — the exact card order (header → mutation-error → field-grid → SLA → Escalations → History) and the exact shared JSX shape across the Escalations/History cards (loading `Skeleton`, error `Alert`, empty `<p>`, populated `<ol>` of `<li>`) — the direct template for the new Notes card, appended after History.
9. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx` — the `describe("SLA escalations card (Story 49)", ...)` block, the exact template to mirror for the new Notes tests, including its `queryResult` helper and "does not interfere with X card" isolation tests.
10. `apps/web/src/lib/tickets-api.ts` — `TicketEscalation`/`getTicketEscalations` (read-side template) and `CreateContactInput`/`createContact` (create-side template, since no ticket-scoped create-child precedent exists yet in this file).
11. `apps/web/src/hooks/use-tickets.ts` — `useTicketEscalationsQuery`, `useCreateContactMutation` (closest create-mutation-hook precedent), and the current, exact `invalidateTicketQueries` body (needs one new line added).
12. `apps/web/src/hooks/use-ticket-realtime.ts` — the exact "every subscribed event shares one `handleUpdate` handler that unconditionally calls `invalidateTicketQueries`" pattern — confirms adding a new event is a two-line addition with zero new branching logic.

---

## Design decisions

1. **Permission: reuse `ticket:create` (notes) and `ticket:read` (reading notes) — no new key.** Direct precedent: `POST /customers/:id/contacts` (a child resource under an existing parent) reuses `customer:create`, never minting a `contact:create` key; `GET /tickets/:id/history` reuses `ticket:read`. Both precedents apply directly and consistently to `TicketNote`. `ticket:update` is never invoked — there is no edit/delete route.
2. **Data model: `TicketNote`, mirroring `TicketHistoryEntry` with one deliberate, disclosed deviation.** Lives in `ticketing` schema, `ticketId` FK with `onDelete: Cascade`, single `@@index([ticketId])`, no own `branchId` (scoping inherited transitively via the parent `Ticket`, exactly like `TicketHistoryEntry`). **Deviation**: `authorUserId` is **required** (`String`), not nullable like `TicketHistoryEntry.actorUserId` — a history entry can be system-generated (e.g. an SLA escalation has no human actor), but a note can only ever result from a deliberate, authenticated agent action; there is no automated path that would ever create one.
3. **Not the seed of Channels.** `docs/architecture/03-domain-boundaries.md`'s domain table assigns "inbound/outbound messages, threads" to the `channels` schema, `history/timeline` to `ticketing` — already two distinct, separately-owned concepts, not one merged idea. `docs/architecture/06-communication-and-realtime.md`'s entire `ChannelMessage` vocabulary (channel type, external thread id, sender, provider) describes exclusively externally-sourced, customer-facing conversation and never contemplates an internal note. `TicketNote` introduces **zero** `channel`/`source`/`externalRef`/discriminator field — if the eventual Channels domain later chooses to unify with or supersede this model, that is a decision for that future, dedicated planning pass, not preempted here.
4. **Ordering: chronological ascending (`createdAt: "asc"`)**, mirroring `getTicketHistory`'s "narrative" convention, not `getTicketEscalations`'s "most recent alert first" descending convention — a note thread reads like a conversation.
5. **Mutation response: `{ id: string }` only**, matching this codebase's universal, established mutation-response convention (never optimistic; the frontend relies on invalidation, never on the mutation's own response, to render the authoritative record).
6. **Realtime event payload deliberately differs from the shared ticket-event shape.** The four existing events share `{ ticket: TicketSummary; actorUserId: string | null }`; `TicketNoteAddedEvent` is `{ ticketId: string; note: TicketNoteSummary }` — the natural payload for a note-added event is the note itself. This has no practical consequence because `useTicketRealtime`'s handler already ignores payload contents entirely (blanket `invalidateTicketQueries` on any subscribed event) — a disclosed, inconsequential shape difference, not an oversight.
7. **New card placement: appended after the History card**, the established append point (SLA → Escalations → History, each added as the new last sibling) — Notes becomes the new last card.
8. **Create UI: an inline textarea + submit button below the notes list**, not a separate route/dialog — mirrors `AddDepartmentForm`'s "smallest UI surface for a one-field create" convention (no dialog primitive exists anywhere in this codebase, confirmed by prior stories' own investigation).
9. **Author display**: resolve `authorUserId` to a full name via a new `userNameById` memo built from the already-fetched `useUsersQuery()` data, mirroring the existing `customerNameById` memo's exact shape in the same file.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`**:
   - Add `notes TicketNote[]` to the `Ticket` model's relation list.
   - Add new model:
     ```prisma
     /// Free-text, agent-only note on a Ticket — never customer-visible, never
     /// sourced from an external channel (see docs/architecture/03-domain-boundaries.md,
     /// "Communication / Channels" — that domain, not this model, owns
     /// customer-facing messages/threads). Append-only: no update/delete route.
     /// No `branchId` — scoping is always derived from the parent Ticket, the
     /// same way `TicketHistoryEntry` has none. Unlike `TicketHistoryEntry`,
     /// `authorUserId` is required, not nullable — a note can only ever result
     /// from a deliberate, authenticated agent action, never a system event.
     model TicketNote {
       id           String   @id @default(uuid())
       ticketId     String   @map("ticket_id")
       ticket       Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
       authorUserId String   @map("author_user_id")
       author       User     @relation(fields: [authorUserId], references: [id])
       body         String
       createdAt    DateTime @default(now()) @map("created_at")

       @@index([ticketId])
       @@map("ticket_notes")
       @@schema("ticketing")
     }
     ```
2. **Migration** — new folder `apps/api/prisma/migrations/20260829120000_add_ticket_notes/migration.sql` (timestamp after the last existing migration `20260829090000_add_role_is_active`), containing the `CREATE TABLE` for `ticketing.ticket_notes` plus its FKs/index, generated via `prisma migrate dev` if Postgres is reachable, hand-authored and diff-verified otherwise (mirroring every recent story's disclosed approach when Docker is unreachable).
3. **New `apps/api/src/modules/tickets/dto/create-ticket-note.dto.ts`**:
   ```ts
   export class CreateTicketNoteDto {
     @ApiProperty()
     @IsString()
     @MinLength(1)
     body!: string;
   }
   ```
   (mirrors `CreateTicketDto.subject`'s exact validation shape — `@IsString() @MinLength(1)`, no arbitrary max length, since no precedent for one exists anywhere in this module).
4. **`apps/api/src/modules/tickets/tickets.events.ts`** — add:
   ```ts
   export const TICKET_NOTE_ADDED_EVENT = "ticket.note-added";

   /** Emitted once, after `TicketsService.createTicketNote` successfully persists
    * the row. Payload deliberately differs from the other ticket events' shared
    * shape (Design item 6) — carries the note itself, not the whole ticket. */
   export interface TicketNoteAddedEvent {
     ticketId: string;
     note: TicketNoteSummary;
   }
   ```
5. **`apps/api/src/modules/tickets/tickets.service.ts`**:
   - Add `TicketNoteSummary` interface (`id`, `ticketId`, `authorUserId`, `body`, `createdAt`).
   - New `getTicketNotes(id: string): Promise<TicketNoteSummary[]>`, mirroring `getTicketHistory` exactly: `await this.findTicketInScope(id);` then `prisma.ticketNote.findMany({ where: { ticketId: id }, orderBy: { createdAt: "asc" } })`, mapped to the summary shape.
   - New `createTicketNote(id: string, dto: CreateTicketNoteDto): Promise<{ id: string }>`: `await this.findTicketInScope(id);` then resolve the authenticated actor's id (mirror however `createTicket`/`updateTicket` already resolve `actorUserId` for `TicketUpdatedEvent` today — confirm the exact `TenantContext` getter or request-scoped mechanism at implementation time, since this wasn't directly quoted during planning), `prisma.ticketNote.create({ data: { ticketId: id, authorUserId, body: dto.body } })`, then `this.eventEmitter.emit(TICKET_NOTE_ADDED_EVENT, { ticketId: id, note: {...} } satisfies TicketNoteAddedEvent)`, return `{ id: note.id }`.
6. **`apps/api/src/modules/tickets/tickets.controller.ts`** — add:
   ```ts
   @Post(":id/notes")
   @RequirePermissions("ticket:create")
   createNote(@Param("id") id: string, @Body() dto: CreateTicketNoteDto): Promise<{ id: string }> {
     return this.ticketsService.createTicketNote(id, dto);
   }

   @Get(":id/notes")
   @RequirePermissions("ticket:read")
   getNotes(@Param("id") id: string): Promise<TicketNoteSummary[]> {
     return this.ticketsService.getTicketNotes(id);
   }
   ```
7. **`apps/api/src/realtime/ticket-realtime.listener.ts`** — add a third `@OnEvent(TICKET_NOTE_ADDED_EVENT)` handler calling the existing `relay(TICKET_NOTE_ADDED_EVENT, event.ticketId, event)` — zero changes to `relay()` itself.
8. **`apps/api/prisma/seed.ts`** — **no change** (no new permission key).
9. **Tests** — see Test Plan.

### Frontend

10. **`apps/web/src/lib/tickets-api.ts`** — add `TicketNoteSummary` interface (mirroring `TicketEscalation`'s shape), `getTicketNotes(id): Promise<TicketNoteSummary[]>` (mirrors `getTicketEscalations`), `CreateTicketNoteInput { body: string }`, `createTicketNote(id, input): Promise<{ id: string }>` (mirrors `createContact`'s exact call shape).
11. **`apps/web/src/hooks/use-tickets.ts`** — add `ticketNotesQueryKey = (id) => ["ticket", id, "notes"] as const`, `useTicketNotesQuery(id)` (mirrors `useTicketEscalationsQuery`, no `staleTime`), `useCreateTicketNoteMutation(id)` (mirrors `useCreateContactMutation`'s shape: `mutationFn: (input) => createTicketNote(id, input)`, `onSuccess` invalidates `ticketNotesQueryKey(id)`). Add `ticketNotesQueryKey(id)` to the existing `invalidateTicketQueries` function's invalidation list.
12. **`apps/web/src/hooks/use-ticket-realtime.ts`** — add `const TICKET_NOTE_ADDED_EVENT = "ticket.note-added";` and `socket.on(TICKET_NOTE_ADDED_EVENT, handleUpdate)` / matching `socket.off` in cleanup — reuses the existing `handleUpdate` handler unchanged.
13. **`apps/web/src/components/tickets/ticket-detail-view.tsx`** — add a `userNameById` memo (mirrors `customerNameById`'s exact shape, built from `usersQuery.data`); add a new Notes card, appended after the History card, using `useTicketNotesQuery(ticketId)` for the list (mirroring the Escalations/History cards' exact loading/error/empty/populated JSX) and `useCreateTicketNoteMutation(ticketId)` for a small inline add-note form (textarea + submit button, disabled until non-empty, `ApiError`-message-or-generic-fallback on failure, cleared on success).
14. **i18n** — additive keys under `tickets.detail`: `notesHeading`, `notesError`, `notesEmpty`, `notesPlaceholder`, `notesSubmit`, `notesSubmitting`, `notesCreateFailed` — in both `en.json`/`ar.json`.
15. **Tests** — see Test Plan.

---

## API contract

`POST /tickets/:id/notes` — `@RequirePermissions("ticket:create")` — body `{ body: string }` — returns `{ id: string }` — 401/403 as usual; 404 `"Ticket not found"` for out-of-branch/nonexistent ticket; 400 for an empty body (validation pipe).
`GET /tickets/:id/notes` — `@RequirePermissions("ticket:read")` — returns `TicketNoteSummary[]` ordered `createdAt` ascending, `[]` if none (never 404 for "no notes yet" — mirrors `getTicketHistory`); 404 for out-of-branch/nonexistent ticket.

## Authorization / tenant-scoping rules

Identical mechanism to every other ticket-child resource: `findTicketInScope(id)` (branch-scope via `TenantContext.requireBranchScope()` + `prisma.ticket.findFirst({ id, branchId })`) → 404 masking both "doesn't exist" and "exists in another branch" identically.

## Backend implementation

See Implementation Tasks 1-8.

## Frontend implementation

See Implementation Tasks 10-14.

## Tests

**Backend unit** (extend `apps/api/src/modules/tickets/tickets.service.spec.ts`):
- `createTicketNote`: success (assert `prisma.ticketNote.create` call args and that `TICKET_NOTE_ADDED_EVENT` was emitted with the correct payload); 404 for a ticket not in the caller's branch (assert `prisma.ticketNote.create` never called).
- `getTicketNotes`: returns notes ordered `createdAt: "asc"` (assert exact `findMany` args); returns `[]` for a ticket with no notes (not an error); 404 for a ticket not in the caller's branch.

**Backend e2e** (extend `apps/api/test/tickets.e2e-spec.ts`, reusing its existing self-contained fixture/`ticketId` pattern):
- 401 for both `POST` and `GET`.
- 403 for the Agent-role user (lacks `ticket:create`/`ticket:read` — mirror the file's existing per-route 403 recipe).
- Successful `POST` followed by `GET` reflects the created note.
- Chronological ordering (create 2 notes, assert order in the `GET` response).
- 404 for an unknown/cross-branch ticket id.
- 400 for an empty `body`.

**Frontend component** (extend `ticket-detail-view.spec.tsx`, mirroring the `describe("SLA escalations card (Story 49)", ...)` block exactly): loading/error/empty/populated states for the Notes card; author-name + timestamp rendering per note; add-note form (disabled-until-non-empty, exact `{ body }` payload, success clears the field and shows the new note via invalidation, failure shows the backend's own message or a generic fallback); two "does not interfere with X card" isolation tests (History, and whichever card ends up adjacent).

## Regression requirements

Existing SLA/Escalations/History card tests remain green, unmodified. No other admin/ticket screen's tests are affected. `create-ticket-view.tsx`/its spec untouched.

## Migration requirements

**One migration required** — `TicketNote` is a genuinely new Prisma model (unlike Stories 46-49, which needed no schema change). Purely additive: one new table, no existing table altered.

## Edge cases

- A ticket with zero notes → `GET` returns `[]`, not an error (mirrors History's convention).
- Two notes created in rapid succession → ordering is stable via `createdAt: "asc"` (ties broken by insertion order at the DB level, consistent with every other append-only child model in this codebase).
- An agent viewing a ticket in real time when another agent adds a note → sees it appear via the existing `ticket:{id}` room's blanket invalidation, no new socket mechanism.
- A ticket that is later deleted (no such route exists today, but schema-consistency-wise) → `TicketNote` rows cascade-delete via `onDelete: Cascade`, exactly like `TicketHistoryEntry`.

## Security risks/mitigations

- **No new privilege surface** — reuses two already-existing, already-audited permission keys (`ticket:create`, `ticket:read`); no new key, no new grant decision.
- **No customer-visibility risk** — there is no customer-facing surface anywhere in this codebase today (`apps/portal` is a placeholder), so "never customer-visible" is trivially true by construction, not merely a policy statement with nothing enforcing it.
- **Cross-branch leak prevention** — identical `findTicketInScope` mechanism as every other ticket-child resource; a foreign ticket id 404s exactly like every sibling endpoint, never confirming its existence.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e   # requires Docker/Postgres — confirmed unreachable in the planning session's environment; disclose honestly if still unreachable at implementation time, do not weaken/remove e2e tests to work around it
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```
Before adding new tests, re-confirm the CURRENT baseline pass counts directly (do not assume the Story 49 baseline of 277/277 backend and 289/289 frontend still holds verbatim — re-run and use the actual current numbers as the pre-Story-50 floor).

## Done criteria

- [ ] `TicketNote` model exists, migration applied; `Ticket.notes` relation added.
- [ ] `POST /tickets/:id/notes` and `GET /tickets/:id/notes` exist, gated by the existing `ticket:create`/`ticket:read` (no new permission key added anywhere).
- [ ] Notes are append-only (no edit/delete route exists anywhere for them).
- [ ] A new `ticket.note-added` event is relayed into the existing `ticket:{id}` room with zero new gateway/room/auth mechanism.
- [ ] Ticket Detail shows a new Notes card (after History) with correct loading/error/empty/populated states and a working inline add-note form.
- [ ] No `channel`/`source`/`externalRef`/discriminator field exists anywhere in the new model, DTOs, or events.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test (backend, frontend) remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean (not yet committed).

---

## Non-Goals (explicit)

- Customer-visible messages, customer replies, external conversations of any kind.
- Email, WhatsApp, SMS, live chat, web forms, the Integration Hub, `ChannelsModule`, `Channel`/`ChannelMessage`, external thread IDs, provider IDs, or any `channel`/`source` discriminator.
- Customer Portal messaging, AI-generated replies.
- Attachments on notes; editing or deleting a note.
- Ticket pagination/search; `Contact.isActive`; notification read/unread state; `createUser` foreign-key validation; the dead `agent:{id}:presence` realtime room.
- Knowledge Base, Reporting, Customer Portal (as a domain), Integrations, the generic `AutomationRule` engine.
- Any README change.

---

## Dependencies

See Prerequisites. Hard sequencing: schema/migration → service/controller/events → realtime listener → frontend, in that order (each layer depends on the one before it existing and typechecking cleanly).

## Known blockers

Docker Desktop unreachable in the planning session's environment — e2e cannot be executed at plan time; the suite is designed and will be disclosed as not-run (not fabricated) if still unreachable at implementation time, exactly as every recent story has done. This does not change the E2E strategy or weaken the test plan itself.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
