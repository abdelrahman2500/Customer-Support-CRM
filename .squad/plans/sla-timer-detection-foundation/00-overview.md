# sla-timer-detection-foundation — plan overview

Entry point for the **sla-timer-detection-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 15  | [15-story-sla-timer-detection-foundation.md](./15-story-sla-timer-detection-foundation.md) | SLA Timer Detection Foundation | —          | `project-foundation` Story 02, `sla-policy-foundation` Stories 10–13, `background-job-producer-foundation` Story 14 |

## Dependency notes

- New feature slug, separate from both `sla-policy-foundation` and `background-job-producer-foundation` — this story is the first to actually bridge them (a domain behavior that spans two apps and two prior infrastructure stories), so it earns its own slug rather than being folded into either.
- This story resolves the architectural tension a roadmap recon (performed after Story 14) identified: background detection must run in `apps/worker` (matching the established BullMQ-consumer convention), but `EventEmitter2`-based domain events are `apps/api`-only and in-process. The resolution is a narrow, SLA-specific BullMQ hand-back bridge — not a generic cross-process event bus.
- Establishes, for the first time: Prisma/database access inside `apps/worker`; a BullMQ consumer (`@Processor`) inside `apps/api`; automated tests of any kind inside `apps/worker`.
- Deliberately does not implement `ticket.recategorized`/SLA recomputation (a future story), escalation *reactions* (a future story), Notifications, or any other consumer of `sla.at_risk`/`sla.breached` beyond emitting them.
