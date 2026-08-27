# agent-workspace-ticket-operations-mvp — plan overview

Entry point for the **agent-workspace-ticket-operations-mvp** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 23  | [23-story-agent-workspace-ticket-operations-mvp.md](./23-story-agent-workspace-ticket-operations-mvp.md) | Agent Workspace — Ticket Operations MVP | — | `project-foundation` Story 02, `customer-management` Story 06, `ticketing` Stories 07–09, `sla-policy-foundation` Stories 10–13, `realtime-socketio-foundation` Story 20 |

## Dependency notes

- New feature slug; the first story to give `apps/web` real screens — it replaces the Story 02 placeholder `login`/`dashboard` routes, which were always documented as wiring proofs, not finished screens.
- Consumes existing, unmodified contracts: `TicketsController`/`TicketsService` (Stories 07–09), `SlaTargetsController`/`SlaTargetsService` (Story 11+), `CustomersController` (Story 06), `UsersController` (Story 03), and the `ticket:{id}` Socket.IO room + `TicketRealtimeListener` (Story 20). No existing emitter, listener, event payload, or SLA/escalation business rule is modified.
- Makes two small, mechanical, non-business extensions to existing backend contracts (same response shape, no new envelope): (1) expose `createdAt`/`updatedAt` on `TicketSummary`; (2) add optional filter/sort query parameters to `GET /tickets` and include each ticket's existing `slaTarget` relation in the list response. Neither changes an existing response shape's meaning for existing callers (all new fields/params are additive and optional).
- Adds environment-configured CORS support (`apps/api/src/main.ts`, `RedisIoAdapter`) — the prerequisite `realtime-socketio-foundation` Story 20's own plan named as blocking any future real browser client.
- Does **not** touch `NotificationLog`, either Notifications-domain listener, `BranchNotificationRealtimeListener` (Story 22), `RealtimeGateway`'s authorization rule, SLA computation/escalation logic, or CASL (Story 07's deferral stands).
- Explicitly excludes full-text search and pagination — no existing backend precedent for either (zero `@Query()` usage anywhere in `apps/api/src` prior to this story), flagged as a follow-up dependency rather than invented here.
