# crm-product-redesign — progress

Live status of the product redesign track.

- Plan: [`00-overview.md`](./00-overview.md)
- Direction: [`visual-direction.md`](./visual-direction.md)
- Board spec: [`tickets-kanban-ux.md`](./tickets-kanban-ux.md)
- Foundation track (Stories 177–209, complete): [`../crm-ui-ux-redesign/progress.md`](../crm-ui-ux-redesign/progress.md)

## Status

**Active roadmap — approved 2026-10-05.** No Story of this track has started; Story 210 (PR-1.1) begins on instruction. The next free Story number is **210**.

## Approved decisions (2026-10-05)

PD-1 indigo accent · PD-2 `@dnd-kit/core` · PD-3 Tickets board is the default view · **PD-4 realtime broadcast deferred** (30s refetch + on focus; no backend change) · PD-5 confirm before Resolved/Closed · PD-6 dev-only demo dataset · PD-7 "Forgot password?" becomes a help hint · **PD-8 Latin digits kept in the Arabic UI** (supersedes the intent of foundation-track D4) · PD-9 local-only screenshot tests · PD-10 navigation regrouped, same pages and URLs · PD-11 same Story workflow.

## Execution rules

- This track is the **active roadmap**. The foundation track's unstarted items (RD-3.10 … RD-7.8) are **not implemented individually**; each is merged into a Story here (`00-overview.md` §3).
- Completed Stories 177–209 are preserved and are not reopened or modified, unless a concrete dependency of a Story here makes it unavoidable (to be stated in that Story's plan).

## Workflow (unchanged from the foundation track)

Per Story:
1. `squad new-story <kebab-title> --no-tracker --title "<kebab-title>"`, then fill the intake from this track's roadmap entry.
2. `squad new-plan`; write `.squad/plans/<kebab-title>/NN-story-<kebab-title>.md`.
3. Review → implement → verify (the §6 definition of done in `00-overview.md`).
4. Commit `feat(story-NN): …` (path-scoped) → push → record here → `docs(squad): record Story NN …` → push.

Rules:
- One intake, one plan, one Story, one commit.
- **Never** run `squad new-story` / `squad new-plan` with the slug `crm-product-redesign`: this folder is the track's umbrella.

## Story / Plan cross-reference

| Track ID | Squad Story (intake) | Plan | Commit |
|---|---|---|---|

## Stories

| Track ID | Story | Summary | Verification | Commit | Push | Deferred |
|---|---|---|---|---|---|---|
