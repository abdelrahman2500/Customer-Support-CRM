# ticketing — plan overview

Entry point for the **ticketing** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                                     | Title                                          | Tracker id | Depends on                          |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------- | ------------------------------------- |
| 07  | [07-story-ticket-and-assignment-foundation.md](./07-story-ticket-and-assignment-foundation.md) | Ticketing: Ticket & Assignment Foundation        | —          | `project-foundation` Story 05, `customer-management` Story 06 |

## Dependency notes

- Story 07 is the first story of this feature. It depends on `project-foundation` Stories 01–05 (`TenantContext`, the global `AuthGuard`/`PermissionsGuard`/`AuditInterceptor`, the seed/test conventions) and `customer-management` Story 06 (the real `Customer`/`Contact` records `Ticket.customerId`/`contactId` reference) — see [../project-foundation/00-overview.md](../project-foundation/00-overview.md) and [../customer-management/00-overview.md](../customer-management/00-overview.md).
- Story 07 deliberately defers domain-event emission (`ticket.created`/`ticket.updated`/`ticket.escalated`, named in [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md)) and CASL-based per-record ticket visibility (named in [docs/architecture/05-auth-and-security.md](../../../docs/architecture/05-auth-and-security.md)) to a later story — both are settled, explicit exclusions for this story, not oversights. It also defers ticket history/timeline, the same way Story 06 deferred Customer interaction history.
- SLA & Automation, Communication/Channels, Customer Portal, Knowledge Base, AI Services, Notifications, Reporting & Analytics, Administration, and Integrations remain separate, not-yet-started feature slugs per `docs/architecture/03-domain-boundaries.md` — every one of them depends on a real `Ticket` existing (SLA reacts to `ticket.created`; Channels ties messages to `Ticket.externalRef`; the Portal's entire scope is submitting/tracking tickets), which is exactly why this feature comes before any of them.
