# agent-workspace-customer-management — plan overview

Entry point for the **agent-workspace-customer-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 26  | [26-story-agent-workspace-customer-management.md](./26-story-agent-workspace-customer-management.md) | Agent Workspace — Customer List & Detail | — | `customer-management` Story 06, `agent-workspace-ticket-operations-mvp` Story 23, `agent-workspace-ticket-customer-creation` Story 25 |

## Dependency notes

- New feature slug. Consumes `GET /customers`/`GET /customers/:id` (Story 06) exactly as already implemented and tested — `CustomersController`/`CustomersService` are not modified.
- Extends the existing Agent Workspace (`apps/web`) — mirrors Story 23's Ticket List/Detail patterns (`ui/` primitives, TanStack Query hooks, i18n, dedicated routes) onto the Customers domain, and becomes a sibling of Story 25's `customers/new` route.
- Read-only: no customer edit, no contact CRUD — `PATCH /customers/:id` and the Contacts endpoints beyond the already-embedded read stay unused by the frontend.
- Does **not** touch realtime (`RealtimeGateway`, `TicketRealtimeListener`, `BranchNotificationRealtimeListener`), notifications, SLA-policies, or `schema.prisma`/migrations.
