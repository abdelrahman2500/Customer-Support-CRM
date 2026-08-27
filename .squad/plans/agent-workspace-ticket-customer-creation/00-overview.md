# agent-workspace-ticket-customer-creation — plan overview

Entry point for the **agent-workspace-ticket-customer-creation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 25  | [25-story-agent-workspace-ticket-customer-creation.md](./25-story-agent-workspace-ticket-customer-creation.md) | Agent Workspace — Ticket & Customer Creation | — | `customer-management` Story 06, `ticketing` Stories 07–09, `agent-workspace-ticket-operations-mvp` Story 23 |

## Dependency notes

- New feature slug. **Numbering note:** NN 24 is intentionally absent from `.squad/plans` — "Agent Workspace: In-App Notification Display" (the real Story 24) was implemented directly from a user-supplied specification without going through this squad-kit workflow, and no retroactive Story 24 intake/plan is fabricated here. This story is filed as NN 25 to keep the numbering aligned with the real, already-shipped story count rather than colliding with it.
- Consumes `POST /customers` (Story 06) and `POST /tickets` (Story 07) exactly as already implemented and tested — neither `CustomersController`/`CustomersService`/`CreateCustomerDto` nor `TicketsController`/`TicketsService`/`CreateTicketDto` is modified.
- Extends the existing Agent Workspace (`apps/web`, Story 23) — reuses its `ui/` primitives, TanStack Query hooks/conventions, i18n message catalogs, and routing pattern (dedicated routes, not a modal).
- Does **not** touch realtime (`RealtimeGateway`, `TicketRealtimeListener`, `BranchNotificationRealtimeListener`), notifications (`NotificationLog` and its listeners, Story 24's notification consumer), SLA-policies, or `schema.prisma`/migrations.
- No new permission — `customer:create`/`ticket:create` already exist and are already granted to `SuperAdmin`.
