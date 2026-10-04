# sla-indicator — plan overview

Entry point for the **sla-indicator** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 192 | [192-story-sla-indicator.md](./192-story-sla-indicator.md) | SlaIndicator (CRM UI/UX redesign RD-1.15) | — (`--no-tracker`) | Story 185 (RD-1.8 Badge tones/icon), Story 191 (RD-1.14 badges in the same rows), decision D3 |

## Dependency notes

- Part of the CRM UI/UX redesign track: [`../crm-ui-ux-redesign/`](../crm-ui-ux-redesign/00-overview.md). Intake: [`../../stories/sla-indicator/sla-indicator/intake.md`](../../stories/sla-indicator/sla-indicator/intake.md).
- At-risk is a presentation tier only (D3). The reports page's average-resolution duration keeps `formatRemaining` (not an SLA indicator).
