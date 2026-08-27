# ticket-history-timeline-completion — plan overview

Entry point for the **ticket-history-timeline-completion** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 21  | [21-story-ticket-history-timeline-completion.md](./21-story-ticket-history-timeline-completion.md) | Ticket History & Timeline Completion | — | `ticketing` Story 09, `ticket-recategorization-sla-target-recomputation` Story 16, `sla-breach-escalation` Story 17 |

## Dependency notes

- New feature slug, but extends the existing `TicketHistoryListener` (`apps/api/src/modules/tickets/ticket-history.listener.ts`, Story 09) — not a new module, table, or migration.
- Closes a gap directly verified in the current repository: `TicketHistoryListener` subscribes only to `ticket.created`/`ticket.updated` (Story 09) and has never been revisited since `ticket.recategorized` (Story 16) and `ticket.escalated` (Story 17) were introduced — both events already exist, are already fully specified, and already share the exact payload shape (`TicketSummary` + `actorUserId`) the listener's existing `record()` helper already persists unmodified.
- Does not modify `TicketsService`, `SlaTargetListener`, `TicketEscalationListener`, any Notifications-domain listener, `apps/worker/**`, or `apps/api/src/queues/**`.
- No Prisma schema/migration change — `TicketHistoryEntry.eventType` is an unconstrained `String` column; no enum, no `CHECK` constraint, no new column.
