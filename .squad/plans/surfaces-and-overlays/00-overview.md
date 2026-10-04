# surfaces-and-overlays — plan overview

Entry point for the **surfaces-and-overlays** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 187 | [187-story-surfaces-and-overlays.md](./187-story-surfaces-and-overlays.md) | Surfaces and overlays (CRM UI/UX redesign RD-1.10) | — (`--no-tracker`) | Story 179 (RD-1.2 tokens), Story 181 (RD-1.4 dark tokens), Stories 185–186 (RD-1.8/1.9 primitives) |

## Dependency notes

- Part of the CRM UI/UX redesign track; roadmap, progress and audit live in [`../crm-ui-ux-redesign/`](../crm-ui-ux-redesign/00-overview.md). Intake: [`../../stories/surfaces-and-overlays/surfaces-and-overlays/intake.md`](../../stories/surfaces-and-overlays/surfaces-and-overlays/intake.md).
- Shared contract: `packages/ui` (consumed by `apps/web` and `apps/portal`) stays translation-free; the only API addition is the optional `DialogContent` `size`.
- Downstream: RD-2.5 (ErrorState), RD-3.3 (inspector), RD-4.5 and RD-6.x (dialog sizes), RD-6.1 (Sheet) build on the surfaces and overlays defined here.
