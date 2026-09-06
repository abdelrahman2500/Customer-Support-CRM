# RM-25 — SLA Pause/Resume ("On Hold" Clock)

**Priority:** P3 · **Complexity:** Small · **Blocked:** No · **Phase:** Parallel / unphased

## Goal

Let a ticket enter an on-hold state that pauses its SLA clock, and resume
it (shifting the target forward by the held duration) on exit.

## Why it exists

Not one of the 12-core bullet requirements verbatim, but a real,
Recon-confirmed gap directly under SLA & Automation: `SlaTicketTarget`
targets are fixed absolute timestamps computed once at ticket creation/
recategorization, with no mechanism to pause the clock while a ticket is
genuinely waiting on the customer (a common, expected SLA behavior).

## Dependencies

Existing `SlaTimerProcessor`/`SlaTransitionEvaluator` (`apps/worker`).

## Backend work

- Add `onHoldSince` (nullable) to `SlaTicketTarget`.
- A new or reused ticket-level "on hold" trigger (decide during
  implementation whether this is a new boolean flag or an existing status
  value repurposed — a new explicit flag is likely cleaner than overloading
  `TicketStatus`, avoiding interaction with `RM-01`'s transition graph).
- On entering hold: set `onHoldSince = now()`. On leaving hold: compute the
  held duration (`now() - onHoldSince`), add it to both
  `responseTargetAt`/`resolutionTargetAt` (whichever hasn't already passed),
  clear `onHoldSince`.

## Frontend work

- A "place on hold" / "resume" action in `TicketDetailView`, near the
  existing SLA countdown display; the SLA card should visibly indicate
  "on hold" instead of a ticking countdown while held.

## Worker/realtime work

- Extend `SlaTransitionEvaluator`'s breach/at-risk math to skip evaluation
  entirely for a currently-on-hold ticket (never breach/at-risk while held).

## Schema/migration work

One new nullable field on `SlaTicketTarget`; one migration.

## Tests

- `sla-target.listener.spec.ts` / `sla-transition-evaluator.spec.ts` —
  extend: a ticket held for N minutes has its targets shift forward by N
  minutes on resume; breach detection correctly ignores held time; a
  ticket already breached before being held is unaffected retroactively
  (holding does not un-breach a target already passed).

## Acceptance criteria

- A ticket held for N minutes has its response/resolution targets shift
  forward by N minutes on resume.
- Breach/at-risk detection correctly ignores time spent on hold.
- No customer-facing "on hold" messaging is introduced by this story
  (backend timer behavior + agent-facing UI only, per its own non-goal).

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/worker test`,
  `pnpm --filter @crm/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
  pass.
- One dedicated commit, pushed.
