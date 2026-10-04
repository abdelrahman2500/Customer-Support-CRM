# locale-aware-date-time-helper — plan overview

Entry point for the **locale-aware-date-time-helper** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 194 | [194-story-locale-aware-date-time-helper.md](./194-story-locale-aware-date-time-helper.md) | Locale-aware date/time helper (CRM UI/UX redesign RD-1.17) | — (`--no-tracker`) | Decision D4 (approved), Story 192 (SlaIndicator date sites) |

## Dependency notes

- Part of the CRM UI/UX redesign track: [`../crm-ui-ux-redesign/`](../crm-ui-ux-redesign/00-overview.md). Intake: [`../../stories/locale-aware-date-time-helper/locale-aware-date-time-helper/intake.md`](../../stories/locale-aware-date-time-helper/locale-aware-date-time-helper/intake.md).
- One implementation in `@crm/ui` (translation-free, locale as a parameter) instead of one per app — see the plan's design decision 1. `formatRelative` is ready for RD-3.x.
