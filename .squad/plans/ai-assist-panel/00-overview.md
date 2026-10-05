# ai-assist-panel — plan overview

Entry point for the **ai-assist-panel** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 209 | [209-story-ai-assist-panel.md](./209-story-ai-assist-panel.md) | AI assist panel (CRM UI/UX redesign RD-3.9) | — (`--no-tracker`) | Stories 203 (inspector), 206 (timeline), 208 (AI insert) |

## Dependency notes

- Part of the CRM UI/UX redesign track: [`../crm-ui-ux-redesign/`](../crm-ui-ux-redesign/00-overview.md). Intake: [`../../stories/ai-assist-panel/ai-assist-panel/intake.md`](../../stories/ai-assist-panel/ai-assist-panel/intake.md).
- Client state only; no AI result is persisted beyond what the API already stores.
