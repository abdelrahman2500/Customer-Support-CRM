# ticket-header-identity-and-state — plan overview

Entry point for the **ticket-header-identity-and-state** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 201 | [201-story-ticket-header-identity-and-state.md](./201-story-ticket-header-identity-and-state.md) | Ticket header: identity and state (CRM UI/UX redesign RD-3.1) | — (`--no-tracker`) | Phase 2; Stories 189, 191, 192, 194 |

## Dependency notes

- Part of the CRM UI/UX redesign track: [`../crm-ui-ux-redesign/`](../crm-ui-ux-redesign/00-overview.md). Intake: [`../../stories/ticket-header-identity-and-state/ticket-header-identity-and-state/intake.md`](../../stories/ticket-header-identity-and-state/ticket-header-identity-and-state/intake.md).
- Introduces the Phase 3 section-survival guard (`ticket-detail-view.spec.tsx`), extended by every later Phase 3 Story. Header actions are RD-3.2. Channel deferred (no field on Ticket).
