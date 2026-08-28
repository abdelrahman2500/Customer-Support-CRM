# agent-workspace-ticket-creation-fields — plan overview

Entry point for the **agent-workspace-ticket-creation-fields** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 43  | [43-story-agent-workspace-ticket-creation-fields.md](./43-story-agent-workspace-ticket-creation-fields.md) | Agent Workspace — Ticket Creation: Contact / Department / Assignee | — | `ticketing` Story 07/25 (`CreateTicketDto`), `agent-workspace-customer-management` Story 26 (`useCustomerQuery`/embedded contacts), `identity-branch-department-listing` Story 35/`agent-workspace-user-admin` Story 38 (`useDepartmentsQuery`), `agent-workspace-ticket-operations-mvp` Story 23 (`useUsersQuery`) |

## Dependency notes

- Not a new screen — extends the existing `CreateTicketView` (Story 25/27), the complementary half of Story 42's ticket-field completion (that story closed the `PATCH`-side gap; this one closes the `POST`-side gap).
- Consumes `POST /tickets`'s existing `contactId`/`departmentId`/`assignedToUserId` fields (`CreateTicketDto`, unchanged since Story 07/25) — `TicketsController`/`TicketsService`/DTOs are not modified. No new backend contract.
- Reuses three already-existing hooks verbatim: `useCustomerQuery` (Story 26, embedded contacts — given one small, backward-compatible `enabled` guard so it's safe to call before a customer is chosen), `useDepartmentsQuery` (Story 38), `useUsersQuery` (Story 23).
- Does **not** touch Ticket Detail (Story 42's surface), realtime, notifications, SLA computation, `schema.prisma`/migrations, or any worker code.
- **Sequencing, not parallel-safety**: this story and Story 42 both touch `apps/web/src/lib/tickets-api.ts` — Story 42 has already merged (not concurrent), so there is no live conflict; this is recorded for the historical record, not as an active constraint.
