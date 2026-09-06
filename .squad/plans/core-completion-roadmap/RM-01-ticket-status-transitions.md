# RM-01 — Formal Ticket Status Transition Rules

**Priority:** P2 · **Complexity:** Small · **Blocked:** No · **Phase:** 1 (Agent Experience)

## Goal

Enforce a valid transition graph for `TicketStatus`, replacing today's
accept-anything behavior in `TicketsService.updateTicket`.

## Why it exists

`updateTicket` currently accepts any `TicketStatus` value from any current
status — only the `resolvedAt` tier-boundary logic (`RESOLVED_STATUSES`)
reacts specially. A client can legally jump `CLOSED → OPEN → CLOSED`, or
skip states, with no server-side guard. This is a data-integrity gap, not a
missing feature — the enum and its consumers (history, SLA, reporting) all
already assume tickets move through a sensible lifecycle.

## Dependencies

None. Purely additive validation inside an existing method.

## Backend work

- Define a transition table, e.g.:
  `OPEN → {IN_PROGRESS, RESOLVED}`, `IN_PROGRESS → {OPEN, RESOLVED}`,
  `RESOLVED → {CLOSED, IN_PROGRESS}`, `CLOSED → {OPEN}` (explicit reopen
  only) — same-status "transitions" (no-op) always allowed.
- Validate in `TicketsService.updateTicket` before persisting; on an invalid
  transition, throw a `BadRequestException` naming the attempted transition
  (`"Cannot move ticket from RESOLVED to URGENT"`-shaped message — status
  values aren't priorities, correct the example to a real invalid pair when
  implementing).
- No change to `resolvedAt` tier logic — it already only reacts to the
  RESOLVED/CLOSED tier boundary, which the new graph is consistent with.

## Frontend work

- `ticket-detail-view.tsx`'s status `Select` should only offer the
  currently-valid next statuses (read from a small shared constant, not
  duplicated logic) — a minor UX improvement riding on the same backend
  table, not a separate design effort.

## Worker/realtime work

None.

## Schema/migration work

None — `TicketStatus` enum values are unchanged, only which transitions
between existing values are accepted.

## Tests

- `tickets.service.spec.ts` — extend with one case per valid transition and
  at least three invalid-transition rejection cases (including the
  `CLOSED → RESOLVED` direct-skip case and a same-status no-op case).
- `tickets.e2e-spec.ts` — one new test asserting a 400 with a descriptive
  message on an invalid transition attempt.

## Acceptance criteria

- Every currently-working ticket workflow (including reopening a closed
  ticket) continues to work unchanged.
- An invalid transition is rejected with a 400 and a message naming the
  attempted transition.
- The ticket status dropdown never offers a transition the backend would
  reject.

## Definition of Done

- All acceptance criteria verified by the new tests above.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/web test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
