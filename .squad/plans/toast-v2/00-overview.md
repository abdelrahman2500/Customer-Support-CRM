# toast-v2 — plan overview

Entry point for the **toast-v2** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 190 | [190-story-toast-v2.md](./190-story-toast-v2.md) | Toast v2 (CRM UI/UX redesign RD-1.13) | — (`--no-tracker`) | Story 185 (RD-1.8 tones/icons), Story 187 (RD-1.10 raised surface, overlay shadow, fade) |

## Dependency notes

- Part of the CRM UI/UX redesign track: [`../crm-ui-ux-redesign/`](../crm-ui-ux-redesign/00-overview.md). Intake: [`../../stories/toast-v2/toast-v2/intake.md`](../../stories/toast-v2/toast-v2/intake.md).
- `showSuccessToast` and `SuccessToaster` keep their contracts; `showToast(message, { tone })` is additive. Notification wording (the portal's raw status text) is RD-1.16.
