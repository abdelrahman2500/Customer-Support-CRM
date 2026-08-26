> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticketing/ticketing-ticket-history-timeline/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `ticketing`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

_(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)_

```
Ticketing: Ticket History / Timeline
```

---

## Description

Implement Ticket History / Timeline for the Ticketing domain.

The Ticketing architecture explicitly owns "history/timeline". Story 08 already emits
ticket.created and ticket.updated domain events after successful Ticket writes.

This story must persist an append-only history entry for every emitted ticket.created
and ticket.updated event and expose that history through a minimal,
branch-scoped GET /api/v1/tickets/:id/history endpoint.

The history record must capture:

- The Ticket it belongs to.
- The actor who performed the action.
- The event type.
- The complete post-write TicketSummary snapshot.
- The creation timestamp.

Actor identity must come from TenantContext.userId at the point where TicketsService
already emits the domain event.

The actor must be added to TicketCreatedEvent and TicketUpdatedEvent as a sibling
field to ticket. It must NOT be added to TicketSummary, so existing Ticket REST
response shapes remain unchanged.

The new history model belongs to the existing ticketing Prisma schema.

The history model must NOT contain branchId. Branch scoping must always be derived
through the parent Ticket, following the existing Contact -> Customer scoping
pattern.

The history listener must subscribe to ticket.created and ticket.updated using
NestJS EventEmitter @OnEvent decorators.

The listener must persist exactly one history row per emitted event.

The listener must catch and log its own persistence failures and must never allow
those failures to propagate back to the original Ticket request.

TicketsService eventEmitter.emit() calls must remain synchronous and must not be
wrapped in try/catch.

The history snapshot must be the complete event.ticket payload exactly as received.
No before/after diff, changed-fields calculation, or semantic "what changed" logic
is introduced.

A PATCH with no effective fields still produces ticket.updated today and therefore
must also produce a history entry. No-op suppression is out of scope.

Expose:

GET /api/v1/tickets/:id/history

The endpoint:

- Lives on the existing TicketsController.
- Requires ticket:read.
- Resolves the parent Ticket through the existing findTicketInScope().
- Returns 404 for unknown or out-of-scope tickets.
- Orders entries by createdAt ascending.
- Has no pagination.
- Returns actorUserId as a bare id.
- Does not resolve actor details into a user object.

No new permission is introduced.

This story does not modify admin.audit_logs or AuditInterceptor. The existing admin
audit mechanism is a separate, coarse cross-domain mechanism and is not the
Ticket-facing timeline.

The implementation must remain limited to Ticket History / Timeline and must not
introduce queues, retries, idempotency, Socket.IO, Notifications, SLA, Channels,
Customer Portal access, or other future functionality.

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

TicketCreatedEvent carries actorUserId: string | null as a sibling of ticket.
TicketUpdatedEvent carries actorUserId: string | null as a sibling of ticket.
TicketSummary remains unchanged.
actorUserId is sourced from TenantContext.userId at the existing event emission points in TicketsService.
No new TicketsService constructor dependency is introduced for actor identity.
TicketHistoryEntry exists in the existing ticketing Prisma schema.
TicketHistoryEntry contains exactly: id, ticketId, actorUserId, eventType, snapshot, createdAt.
actorUserId is nullable.
ticketId references Ticket.
actorUserId references User.
TicketHistoryEntry has no branchId.
Ticket has the required back-relation to TicketHistoryEntry.
User has the required back-relation to TicketHistoryEntry.
eventType is a plain String.
No new Prisma enum is introduced for event types.
snapshot stores the complete event.ticket payload verbatim.
No diff or changed-fields calculation is introduced.
Exactly one TicketHistoryEntry is persisted per ticket.created event.
Exactly one TicketHistoryEntry is persisted per ticket.updated event.
A no-op PATCH still produces a history entry.
TicketHistoryListener subscribes to ticket.created and ticket.updated.
Listener persistence failures are caught and logged.
Listener persistence failures never propagate to the Ticket HTTP request.
TicketsService event emission calls remain unwrapped by try/catch.
EventEmitter2.emit() remains synchronous.
GET /api/v1/tickets/:id/history exists on TicketsController.
The history endpoint requires ticket:read.
The history endpoint resolves the parent ticket through findTicketInScope().
Unknown or out-of-scope tickets return 404.
History entries are returned ordered by createdAt ascending.
The history endpoint has no pagination.
actorUserId is returned as a bare id.
No new ticket:history permission is created.
admin.audit_logs and AuditInterceptor remain untouched.
No branchId is added to TicketHistoryEntry.
No Socket.IO, queue, retry, idempotency, notification, SLA, channel, or Portal functionality is introduced.
No before/after diff or changed-field computation is introduced.
Prisma validation passes.
TypeScript typecheck passes.
Lint passes.
Build passes.
Existing unit tests continue to pass.
New TicketHistoryListener unit tests pass.
Ticket service history tests pass.
E2E coverage verifies create → history.
E2E coverage verifies update → second history entry.
E2E coverage verifies actorUserId.
E2E coverage verifies snapshot contents.
E2E coverage verifies unknown/out-of-scope ticket → 404.
E2E coverage verifies unauthenticated → 401.
E2E coverage verifies insufficient permissions → 403.
The migration is purely additive.
.squad/config.yaml remains untouched.

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder)  | What it is       |
| ------------------------------- | ---------------- |
| _(e.g. `attachments/flow.png`)_ | _(e.g. UX flow)_ |

_(Add rows per file. If none, write "None.")_

---

## Dependencies

Blocked by / related ids: None — Ticketing Story 08 is the prerequisite and is already completed.
Depends on code areas or other stories:
Ticketing Story 07 — existing Ticket domain/model/API.
Ticketing Story 08 — existing ticket.created / ticket.updated domain events.
apps/api/src/modules/tickets/tickets.service.ts
apps/api/src/modules/tickets/tickets.events.ts
apps/api/src/modules/tickets/tickets.controller.ts
apps/api/src/modules/tickets/tickets.module.ts
apps/api/prisma/schema.prisma
Existing TenantContext
Existing AuditInterceptor as a failure-handling precedent.

## Extra notes (optional)

The existing admin.audit_logs mechanism is not the Ticket History implementation.
It is a separate cross-domain audit mechanism and currently records coarse HTTP
request information without a semantic Ticket entity id or snapshot.
TenantContext.userId is already available inside TicketsService.
All existing Ticket routes are authenticated and permission-checked. No change to
AuthGuard, JwtStrategy, or TenantMiddleware is required.
The architecture explicitly identifies Ticketing as owning:
"Tickets, categories, priorities, statuses, assignments, history/timeline".
Existing foundation stories do not introduce pagination, so history follows the
same convention.
Existing Contact scoping provides the precedent for deriving access through the
parent entity instead of storing a redundant branchId.

## Technical hints (optional)

Repo/root: .
Primary language: TypeScript
Framework: NestJS
ORM: Prisma
Database: PostgreSQL
Event mechanism: @nestjs/event-emitter / EventEmitter2
Existing event constants:
TICKET_CREATED_EVENT = "ticket.created"
TICKET_UPDATED_EVENT = "ticket.updated"
Existing context:
TenantContext.userId
TicketsService.findTicketInScope()
Existing permission: ticket:read
Existing failure-handling precedent: apps/api/src/common/audit/audit.interceptor.ts

## Out of scope

ticket.escalated
Socket.IO / live timeline push
Notifications
SLA
Channels
Customer Portal access to ticket history
BullMQ
Queues
Retries
Idempotency
Pagination
Before/after diff
Changed-fields computation
Semantic "what changed" detection
No-op update suppression
New ticket:history permission
Modifications to admin.audit_logs
Modifications to AuditInterceptor
Changes to .squad/config.yaml
Changes to AuthGuard
Changes to JwtStrategy
Changes to TenantMiddleware
Any unrelated Ticket functionality
