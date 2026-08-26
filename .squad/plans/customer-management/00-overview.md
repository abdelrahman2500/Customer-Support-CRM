# customer-management — plan overview

Entry point for the **customer-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                                             | Title                                                | Tracker id | Depends on                    |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- | ------------------------------ |
| 06  | [06-story-customer-and-contact-foundation.md](./06-story-customer-and-contact-foundation.md)       | Customer Management: Customer & Contact Foundation    | —          | `project-foundation` Story 05  |

## Dependency notes

- Story 06 is the first story of this feature. It depends on `project-foundation` Stories 01–05 (see [../project-foundation/00-overview.md](../project-foundation/00-overview.md)) for `TenantContext`, the global `AuthGuard`/`PermissionsGuard`, the global `AuditInterceptor`, and the seed/test conventions Stories 03–05 established — this story reuses all of them unchanged.
- Story 06 introduces the `customers` Postgres schema (`Customer`, `Contact`) and 7 permission-checked REST endpoints. It deliberately excludes **interaction history** and **attachment metadata** — both named under "Customer Management" in [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) — because those depend on Ticketing/Channels domain events and object-storage wiring that don't exist yet. Either could become a later story in this same feature once its real dependency exists.
- Ticketing, Communication/Channels, Customer Portal, SLA & Automation, Knowledge Base, AI Services, Notifications, Reporting & Analytics, Administration, and Integrations remain separate, not-yet-started feature slugs per `docs/architecture/03-domain-boundaries.md`. No story in this feature implements any of them — Ticketing's own future first story is what consumes the real `Customer.id` this story creates.
