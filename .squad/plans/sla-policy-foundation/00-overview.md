# sla-policy-foundation — plan overview

Entry point for the **sla-policy-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                     | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | -------------------------- | ---------- | -------------------------------------------------------- |
| 10  | [10-story-sla-policy-foundation.md](./10-story-sla-policy-foundation.md)   | SLA Policy Foundation      | —          | `project-foundation` Story 05, `ticketing` Stories 07–09 |

## Dependency notes

- Story 10 is the first story of this feature and of the `sla` Postgres schema named in [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md). It was selected as the next story after a repository-level candidate evaluation following `ticketing` Story 09 — a human-confirmed roadmap decision, not a pre-existing definition that was sitting in the repository.
- Story 10 establishes only the `SlaPolicy` domain: schema, branch-scoped permission-checked CRUD, following the exact pattern `customer-management` Story 06 and `ticketing` Story 07 used for their own first stories. It deliberately does **not** implement any part of the runtime SLA automation lifecycle described in [docs/architecture/07-sla-automation-and-ai.md](../../../docs/architecture/07-sla-automation-and-ai.md): no `ticket.created`/`ticket.updated` listener, no target computation, no business-hours calendar, no `sla-timers` BullMQ job, no breach/at-risk detection, no escalation, no `AutomationRule`. All of that is explicitly deferred to later stories in this same feature, once a policy actually exists to consume.
- The existing `ticket.created`/`ticket.updated` event contract (established by `ticketing` Stories 08–09) is unchanged by this story. A future SLA story becomes the second real subscriber to those events, mirroring how `ticketing` Story 09 was the first.
- Communication/Channels, Customer Portal, Knowledge Base, AI Services, Notifications, Reporting & Analytics, Administration, and Integrations remain separate, not-yet-started feature slugs per `docs/architecture/03-domain-boundaries.md`. No story in this feature implements any of them.
