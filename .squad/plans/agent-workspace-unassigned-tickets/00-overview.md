# agent-workspace-unassigned-tickets — plan overview

Entry point for the **agent-workspace-unassigned-tickets** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 29  | [29-story-agent-workspace-unassigned-tickets.md](./29-story-agent-workspace-unassigned-tickets.md) | Agent Workspace — Unassigned Tickets & Self-Assign | — | `agent-workspace-ticket-operations-mvp` Story 23, `agent-workspace-real-dashboard` Story 28 |

## Dependency notes

- New feature slug. Extends `DashboardView` (Story 28) with a second section — does not touch `TicketListView`, `TicketDetailView`, or `CustomerDetailView`.
- Consumes `GET /tickets`/`PATCH /tickets/:id` exactly as already implemented (Story 23) — `TicketsController`/`TicketsService`/DTOs are not modified. No new backend endpoint, DTO field, or permission.
- Does **not** touch realtime, notifications, SLA-policies, `schema.prisma`/migrations, or any worker code.
- NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` — unchanged by this story.
