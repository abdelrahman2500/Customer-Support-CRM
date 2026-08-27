# agent-workspace-real-dashboard — plan overview

Entry point for the **agent-workspace-real-dashboard** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 28  | [28-story-agent-workspace-real-dashboard.md](./28-story-agent-workspace-real-dashboard.md) | Agent Workspace — Real Agent Dashboard | — | `agent-workspace-ticket-operations-mvp` Story 23 |

## Dependency notes

- New feature slug. Replaces the Story 23 `/dashboard` redirect stub with a real page — does not touch `TicketListView`, `CustomerDetailView`, or any other existing screen.
- Consumes `GET /tickets?assignedToUserId=`/`GET /auth/me` exactly as already implemented (Story 23) — `TicketsController`/`TicketsService`/`IdentityController` are not modified. No backend change of any kind.
- Does **not** touch realtime, notifications, SLA-policies, `schema.prisma`/migrations, or any worker code.
- NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` — unchanged by this story.
