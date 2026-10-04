# ticket-presentation — plan overview

Entry point for the **ticket-presentation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 191 | [191-story-ticket-presentation.md](./191-story-ticket-presentation.md) | Ticket status and priority presentation (CRM UI/UX redesign RD-1.14) | — (`--no-tracker`) | Story 185 (RD-1.8 Badge `info`/`progress` variants, `icon` prop) |

## Dependency notes

- Part of the CRM UI/UX redesign track: [`../crm-ui-ux-redesign/`](../crm-ui-ux-redesign/00-overview.md). Intake: [`../../stories/ticket-presentation/ticket-presentation/intake.md`](../../stories/ticket-presentation/ticket-presentation/intake.md).
- Shared data lives in `@crm/shared` (decision D12); `@crm/ui` gains only role-named icons. Portal priority labels/badge are RD-1.16; SLA presentation is RD-1.15.
