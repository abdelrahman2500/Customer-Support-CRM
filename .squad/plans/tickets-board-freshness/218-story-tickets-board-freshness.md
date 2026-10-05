# Story 218 — Tickets board: freshness and verification

> CRM product redesign roadmap item **PR-3.3**. Intake: [`../../stories/tickets-board-freshness/tickets-board-freshness/intake.md`](../../stories/tickets-board-freshness/tickets-board-freshness/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 3; spec `../crm-product-redesign/tickets-kanban-ux.md` §6, §11; decision PD-4 (deferred).

## Prerequisites

Stories 216 and 217.

## Story Goal

Keep the board fresh by refetching, show other people's changes, and verify the move flow end to end.

**Non-goals:** realtime broadcast, versioning, backend changes.

## Design decisions

1. **Refetch** — `useTicketBoardColumnQuery`: `refetchInterval: 30_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true` (the app default is off), all disabled while `paused` (a drag) or while a move mutation (`MOVE_TICKET_MUTATION_KEY`) is pending. Infinite-query refetches reload every loaded page.
2. **Change cue** — each column snapshots its cards after every fetch (`snapshotOf`); `changedSince` cues cards updated after the previous snapshot's newest `updatedAt` (server clock, with a 60s skew guard against the client clock) that are new to the column or whose assignee/priority changed. Own moves (45s window), "Show more" (page count changed) and filter changes (key changed) never cue. The cue is `animate-change-cue` (a 2.4s accent ring keyframe in the preset); reduced motion gets a static ring. `data-changed` marks it for tests.
3. **Collision** — `mutationFn` reads the ticket first; `changedElsewhere` (status, assignee, priority) sets `collided`; the PATCH is still sent (last write wins) and the board shows an info toast.
4. **Robustness found by Playwright** — the filtered empty state no longer unmounts the columns (a refetch that briefly read 0 everywhere stranded the board, because the unmounted columns could not refetch); the first "over" announcement for the card's own column is skipped so "Picked up…" is heard.
5. **Playwright** — two flows; keyboard steps wait for the announcements a screen-reader user hears, never on timeouts.

## Tasks

1. Hook options; snapshot/compare in the column; cue styling; collision in the mutation and the toast.
2. Unit specs (timers, rules, board cue, collision toast); Playwright spec + two additive support helpers.

## Verification Steps

1. web vitest, typecheck, lint, build; e2e typecheck/lint.
2. Playwright full suite.
3. Cue harness (en light, ar dark, reduced motion) as the demo agent.

## Done Criteria

- [ ] Refetch policy, cue, collision toast, Playwright flows; suites green.
