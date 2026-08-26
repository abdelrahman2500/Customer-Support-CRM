# sla-policy-foundation — plan overview

Entry point for the **sla-policy-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                     | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | -------------------------- | ---------- | -------------------------------------------------------- |
| 10  | [10-story-sla-policy-foundation.md](./10-story-sla-policy-foundation.md)   | SLA Policy Foundation      | —          | `project-foundation` Story 05, `ticketing` Stories 07–09 |
| 11  | [11-story-sla-target-computation.md](./11-story-sla-target-computation.md) | SLA Target Computation     | —          | `sla-policy-foundation` Story 10, `ticketing` Stories 07–09 |
| 12  | [12-story-sla-business-hours-calendar-foundation.md](./12-story-sla-business-hours-calendar-foundation.md) | SLA Business-Hours Calendar Foundation | — | `sla-policy-foundation` Stories 10–11, `Branch.timezone` (`project-foundation` Story 02) |

## Dependency notes

- Story 10 is the first story of this feature and of the `sla` Postgres schema named in [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md). It was selected as the next story after a repository-level candidate evaluation following `ticketing` Story 09 — a human-confirmed roadmap decision, not a pre-existing definition that was sitting in the repository.
- Story 10 establishes only the `SlaPolicy` domain: schema, branch-scoped permission-checked CRUD, following the exact pattern `customer-management` Story 06 and `ticketing` Story 07 used for their own first stories. It deliberately does **not** implement any part of the runtime SLA automation lifecycle described in [docs/architecture/07-sla-automation-and-ai.md](../../../docs/architecture/07-sla-automation-and-ai.md): no `ticket.created`/`ticket.updated` listener, no target computation, no business-hours calendar, no `sla-timers` BullMQ job, no breach/at-risk detection, no escalation, no `AutomationRule`. All of that is explicitly deferred to later stories in this same feature, once a policy actually exists to consume.
- The existing `ticket.created`/`ticket.updated` event contract (established by `ticketing` Stories 08–09) is unchanged by Story 10. Story 11 becomes the second real subscriber to those events (`ticket.created` only), mirroring how `ticketing` Story 09 was the first.
- Story 11 is the first story to actually consume a `SlaPolicy`: it introduces `SlaTicketTarget` (also in the `sla` schema) and a listener that computes response/resolution targets when a matching, active policy exists. It deliberately still does not implement business-hours calendars, `sla-timers`, breach/at-risk detection, escalation, or `AutomationRule` — those remain deferred to later stories in this feature.
- Story 12 introduces the business-hours calendar named in `docs/architecture/07-sla-automation-and-ai.md` (`BusinessHoursCalendar`/`BusinessHoursDay`/`BusinessHoursException`, one calendar per `Branch`) as schema + CRUD only — selected via a repository-evidence-based recon after Story 11 as the only remaining SLA & Automation item with no unmet cross-module (Ticketing) or infrastructure (BullMQ producer wiring) prerequisite. It deliberately does not change `SlaTargetListener` or make target computation business-hours-aware — that remains deferred to a future story, the same "foundation before behavior" split Story 10→11 already used.
- Communication/Channels, Customer Portal, Knowledge Base, AI Services, Notifications, Reporting & Analytics, Administration, and Integrations remain separate, not-yet-started feature slugs per `docs/architecture/03-domain-boundaries.md`. No story in this feature implements any of them.
