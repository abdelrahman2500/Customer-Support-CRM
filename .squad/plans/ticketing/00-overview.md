# ticketing — plan overview

Entry point for the **ticketing** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                                     | Title                                          | Tracker id | Depends on                          |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------- | ------------------------------------- |
| 07  | [07-story-ticket-and-assignment-foundation.md](./07-story-ticket-and-assignment-foundation.md) | Ticketing: Ticket & Assignment Foundation        | —          | `project-foundation` Story 05, `customer-management` Story 06 |
| 08  | [08-story-ticketing-domain-events-foundation.md](./08-story-ticketing-domain-events-foundation.md) | Ticketing: Domain Events Foundation         | —          | Story 07 |

## Dependency notes

- Story 07 is the first story of this feature. It depends on `project-foundation` Stories 01–05 (`TenantContext`, the global `AuthGuard`/`PermissionsGuard`/`AuditInterceptor`, the seed/test conventions) and `customer-management` Story 06 (the real `Customer`/`Contact` records `Ticket.customerId`/`contactId` reference) — see [../project-foundation/00-overview.md](../project-foundation/00-overview.md) and [../customer-management/00-overview.md](../customer-management/00-overview.md).
- Story 07 deliberately defers domain-event emission (`ticket.created`/`ticket.updated`/`ticket.escalated`, named in [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md)) and CASL-based per-record ticket visibility (named in [docs/architecture/05-auth-and-security.md](../../../docs/architecture/05-auth-and-security.md)) to a later story — both are settled, explicit exclusions for this story, not oversights. It also defers ticket history/timeline, the same way Story 06 deferred Customer interaction history.
- Story 08 picks up exactly one of Story 07's deferrals: emitting `ticket.created`/`ticket.updated` via `EventEmitter2`. It does not implement `ticket.escalated` (nothing in the current model represents "escalated" as distinct from an ordinary update), does not build any subscriber, and does not touch CASL, ticket history/timeline, or `Ticket.externalRef` — those all remain deferred past this story too.
- SLA & Automation, Communication/Channels, Customer Portal, Knowledge Base, AI Services, Notifications, Reporting & Analytics, Administration, and Integrations remain separate, not-yet-started feature slugs per `docs/architecture/03-domain-boundaries.md`. Story 08 is infrastructure that the first of these to be built (most likely SLA & Automation, per `docs/architecture/07-sla-automation-and-ai.md`'s reliance on `ticket.created`) can subscribe to without any further change to `TicketsService`.
