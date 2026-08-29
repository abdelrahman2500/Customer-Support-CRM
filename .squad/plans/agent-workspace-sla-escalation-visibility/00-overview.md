# agent-workspace-sla-escalation-visibility — plan overview

Entry point for the **agent-workspace-sla-escalation-visibility** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 49  | [49-story-agent-workspace-sla-escalation-visibility.md](./49-story-agent-workspace-sla-escalation-visibility.md) | Agent Workspace: SLA Escalation Visibility | — | `sla-breach-escalation` Story 17 (`SlaEscalation` model and its write path via `sla-escalation.listener.ts`), `sla-timer-detection-foundation` Story 15 / `ticket-history-timeline-completion` Story 21 (the sibling ticket-scoped `sla-target`/`history` read endpoints this mirrors), `agent-workspace-user-profile-correction` Story 48 (most recent prior story, closing the identity/admin arc this story deliberately does not touch) |

## Dependency notes

- Extends the existing `sla-policies` module — no new module. Adds one new controller (`SlaEscalationsController`) and one new service (`SlaEscalationsService`), both new files, registered in the existing `sla-policies.module.ts`.
- **No Prisma schema change and no migration** — `SlaEscalation` already carries every column this story needs (`id`, `ticketId`, `branchId`, `targetType`, `targetAt`, `escalatedAt`); it has been written by `sla-escalation.listener.ts` since Story 17 with zero read exposure anywhere, confirmed by that story's own e2e-spec doc comment stating explicitly no HTTP endpoint exposes these rows "by design."
- **No new permission key** — reuses the existing `sla:read`, which already gates every other SLA-domain read (`GET /sla-policies`, `GET /business-hours-calendars`, and critically the structurally-identical sibling `GET /tickets/:id/sla-target`). `notification:read`/`audit:read` were minted as dedicated keys only because those introduced entirely new resource domains with no existing read key to reuse — `SlaEscalation` is one more read inside the already-established `sla` domain, not a new domain.
- **List endpoint, not singular** — `SlaEscalation`'s own `@@unique([ticketId, targetType, targetAt])` constraint permits multiple rows per ticket (a response breach and a resolution breach are distinct rows), unlike `SlaTicketTarget`'s one-row-per-ticket shape that justifies `sla-target`'s singular `GET`.
- **Empty result returns `[]`, never a 404** — unlike `SlaTargetsService`'s 404-for-missing-target (every ticket is expected to always have exactly one target, computed synchronously at creation), escalations are sparse — most tickets are never breached — so "no escalations" is the normal case, mirroring `NotificationLog`/`AuditLog`'s established "empty array, never 404 for absence of data" convention.
- Frontend: the new ticket-scoped read lives in `tickets-api.ts`/`use-tickets.ts` (not `sla-policies-api.ts`/`use-sla-policies.ts`), following this codebase's own established convention that ticket-scoped SLA reads (the existing `getTicketSlaTarget`) live alongside other ticket reads regardless of which backend module owns them.
