# sla-breach-escalation — plan overview

Entry point for the **sla-breach-escalation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 17  | [17-story-sla-breach-escalation.md](./17-story-sla-breach-escalation.md) | SLA Breach Escalation | — | `sla-timer-detection-foundation` Story 15, `ticket-recategorization-sla-target-recomputation` Story 16 |

## Dependency notes

- New feature slug — the story Story 15's and Story 16's own intakes both named ahead of time: *"Story 17 remains responsible for escalation reactions."* Filed as its own slug rather than folded into `sla-policy-foundation` or `sla-timer-detection-foundation`, matching the precedent those two slugs themselves already set (each earns its own slug when it bridges prior features rather than only extending one).
- Consumes `sla.breached` (Story 15, `apps/api/src/modules/sla-policies/sla-detection.events.ts`) without modifying the scheduler, worker, or detection semantics that produce it. `sla.at_risk` is explicitly not reacted to by this story.
- Builds on Story 16's established fact that a ticket's `SlaTicketTarget` row can be legitimately recomputed (same row id, new `targetAt`) more than once over a ticket's lifetime — this story's idempotency key is keyed on `targetAt` specifically because of that.
- `AutomationRule` (named, unassigned, in `docs/architecture/07-sla-automation-and-ai.md`) is explicitly not built here — this story hard-codes exactly one reaction to exactly one event, the same "narrow foundation before generality" trade-off Story 15 made for its worker-to-api bridge.
- Does not modify `apps/worker/**`, `apps/api/src/queues/**`, or `business-hours-calculator.ts`.
