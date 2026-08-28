# agent-workspace-ticket-detail-reassignment — plan overview

Entry point for the **agent-workspace-ticket-detail-reassignment** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 42  | [42-story-agent-workspace-ticket-detail-reassignment.md](./42-story-agent-workspace-ticket-detail-reassignment.md) | Agent Workspace — Ticket Detail: Subject & Department Reassignment | — | `ticketing` Story 07 (`Ticket.departmentId`), `identity-branch-department-listing` Story 35 (`GET /identity/departments`, already consumed via `useDepartmentsQuery` since Story 38) |

## Dependency notes

- Not a new screen — extends the existing `TicketDetailView` (Story 23) exactly the way Stories 26/30/32/33/38 each extended one existing or new screen with one more already-accepted-but-unconsumed backend field.
- Consumes `PATCH /tickets/:id`'s existing `subject`/`departmentId` fields (`UpdateTicketDto`, unchanged since Story 07/09) — `TicketsController`/`TicketsService`/DTOs are not modified. No new backend contract.
- Reuses `useDepartmentsQuery()` (`apps/web/src/hooks/use-tickets.ts`, added by Story 38) verbatim — no new query/hook.
- Does **not** touch ticket creation, realtime, notifications, SLA computation/timer/escalation, `schema.prisma`/migrations, or any worker code.
- **Sequencing, not parallel-safety**: `agent-workspace-ticket-creation-fields` (the still-to-be-planned Story 43 covering `CreateTicketDto.contactId`/`departmentId`/`assignedToUserId`, referred to as "A3" in prior recon) must **not** run in parallel with this story — both extend `apps/web/src/lib/tickets-api.ts` (this story: `UpdateTicketInput`; that one: `CreateTicketInput`). Story 43 should start only after this story merges.
