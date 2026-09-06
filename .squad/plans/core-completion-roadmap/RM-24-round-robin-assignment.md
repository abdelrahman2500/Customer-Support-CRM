# RM-24 — Round-Robin / Load-Based Automatic Assignment

**Priority:** P3 · **Complexity:** Small-Medium · **Blocked:** No · **Phase:** Parallel / unphased

## Goal

Add an alternate `AutomationRule` action mode that assigns to the
least-loaded eligible agent, instead of always the same fixed agent.

## Why it exists

Core 5 (SLA & Automation) names "Automatic assignment" explicitly.
`AutomationRule` today (Story 57, deliberately v1-scoped) always assigns to
one hardcoded `actionAssignToUserId` — no round-robin or load-based
balancing exists anywhere (confirmed absent by a targeted search).

## Dependencies

Story 57's `AutomationRule`/`AutomationEvaluationListener`. **Verified
safe**: Story 57's own plan explicitly flags a reconciliation risk for any
automation action that changes a ticket's category/priority/department
post-creation (those three fields participate in SLA-policy matching) and
deliberately deferred widening the action set until that's addressed. This
story only ever changes `assignedToUserId`, which Story 57's own note
confirms "participates in no SLA-policy matching dimension" — so it
introduces none of that risk.

## Backend work

- Extend `AutomationRule` with `actionAssignmentMode` (enum:
  `FIXED` | `LEAST_LOADED`, default `FIXED` — preserves every existing
  rule's exact current behavior) and an `eligibleAgentPool` (array of
  `User` ids, only meaningful when mode is `LEAST_LOADED`).
- Extend `AutomationEvaluationListener`'s resolution logic: for
  `LEAST_LOADED`, query open-ticket counts (`OPEN`/`IN_PROGRESS`) per
  eligible agent and assign to whichever has fewest — same query shape
  `getAgentPerformance` (Reporting) already uses, reused rather than
  reinvented.

## Frontend work

- Extend the existing Automation Rules admin UI with a mode toggle and,
  when `LEAST_LOADED`, an eligible-agent-pool multi-select.

## Worker/realtime work

None.

## Schema/migration work

Extend `AutomationRule` with the two new fields above; one migration.
Existing rows default to `FIXED`, `eligibleAgentPool: []` — zero behavior
change for every rule that exists today.

## Tests

- `automation-evaluation.listener.spec.ts` — extend: a `LEAST_LOADED` rule
  assigns to the agent with fewest open tickets among the eligible pool;
  a tie is broken deterministically (e.g. lowest user id, documented);
  existing `FIXED` rules behave exactly as before.

## Acceptance criteria

- A rule configured for `LEAST_LOADED` assigns to whichever eligible agent
  currently has the fewest open tickets.
- Every existing `FIXED` rule continues to behave exactly as before this
  story.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/web test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
