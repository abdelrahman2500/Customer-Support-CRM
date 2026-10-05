# inspector-layout — plan overview

Entry point for the **inspector-layout** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 203 | [203-story-inspector-layout.md](./203-story-inspector-layout.md) | Inspector layout (CRM UI/UX redesign RD-3.3) | — (`--no-tracker`) | Story 201 (RD-3.1), Story 202 (RD-3.2) |

## Dependency notes

- Part of the CRM UI/UX redesign track: [`../crm-ui-ux-redesign/`](../crm-ui-ux-redesign/00-overview.md). Intake: [`../../stories/inspector-layout/inspector-layout/intake.md`](../../stories/inspector-layout/inspector-layout/intake.md).
- Adds `SectionCard` `collapsible` (client module `collapsible-section-card.tsx`). Combobox is RD-3.4; History joins the timeline in RD-3.6.
