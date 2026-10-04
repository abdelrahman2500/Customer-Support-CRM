# table-v2 — plan overview

Entry point for the **table-v2** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 188 | [188-story-table-v2.md](./188-story-table-v2.md) | Table v2 (CRM UI/UX redesign RD-1.11) | — (`--no-tracker`) | Story 179 (RD-1.2 tokens), Story 185 (RD-1.8 Button `icon-sm`), Story 187 (RD-1.10 surfaces) |

## Dependency notes

- Part of the CRM UI/UX redesign track: [`../crm-ui-ux-redesign/`](../crm-ui-ux-redesign/00-overview.md). Intake: [`../../stories/table-v2/table-v2/intake.md`](../../stories/table-v2/table-v2/intake.md).
- `density` defaults to `compact` (today's padding); screens opt into `comfortable` in later Stories (RD-4.3/4.4). The mobile sort control is RD-4.1.
