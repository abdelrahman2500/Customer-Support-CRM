# agent-workspace-customer-ticket-navigation — plan overview

Entry point for the **agent-workspace-customer-ticket-navigation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 27  | [27-story-agent-workspace-customer-ticket-navigation.md](./27-story-agent-workspace-customer-ticket-navigation.md) | Agent Workspace — Customer-to-Ticket Navigation | — | `agent-workspace-ticket-operations-mvp` Story 23, `agent-workspace-ticket-customer-creation` Story 25, `agent-workspace-customer-management` Story 26 |

## Dependency notes

- New feature slug. Purely additive extension of two existing screens (`CustomerDetailView`, `CreateTicketView`) — neither is replaced.
- Consumes `GET /tickets`/`POST /tickets` exactly as already implemented (Story 23/25) — `TicketsController`/`TicketsService`/DTOs are not modified. No backend `customerId` filter is introduced; filtering is client-side over the already-fetched, unpaginated result.
- Does **not** touch realtime, notifications, SLA-policies, or `schema.prisma`/migrations.
- NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` — unchanged by this story.
