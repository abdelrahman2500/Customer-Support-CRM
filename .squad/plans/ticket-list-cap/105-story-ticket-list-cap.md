# Story 105 — Ticketing: List a Bounded Result Cap

## Prerequisites

- `ticketing` Stories 23/70 — `ListTicketsQueryDto`,
  `resolveSearchAndVisibilityFilter`, `TicketsService.listTickets`.
- `audit-log-search` Story 104 — the exact "fixed `take` cap, no
  pagination UI, filters are the tool for narrowing" design precedent
  this story applies to its next target.

All are complete and already merged to `main`.

## Story Goal

Apply a fixed, documented result cap to `GET /tickets`, mirroring Story
104's own `AuditLog` cap exactly, closing the same unbounded-query-growth
risk class on this codebase's highest-write-volume table.

## Non-Goals

- **No pagination (page controls, cursor, `hasMore`/`nextCursor`).**
  Same reasoning as Story 104's own Non-Goals: a materially larger,
  first-of-its-kind decision for this codebase, out of proportion to
  this story's scope. Filtering (`status`/`priority`/`category`/
  `assignedToUserId`/`search`, all already present) is the tool for
  narrowing to see more specific tickets; a future story can add real
  pagination if the cap is ever a measured problem.
- **No change to `listTicketsForCustomer`** (the portal's own "my
  tickets" list) — scoped to exactly one `customerId`, whose realistic
  ticket volume is orders of magnitude smaller than a whole branch's;
  no evidence of a comparable risk there.
- **No change to filtering/sorting/search logic itself** —
  `ListTicketsQueryDto`/`resolveSearchAndVisibilityFilter` are reused
  completely unmodified.
- **No new permission, no new endpoint.**

## Design decisions

1. **`MAX_TICKET_ROWS = 500`**, a module-level constant in
   `tickets.service.ts`, applied unconditionally via `take:
   MAX_TICKET_ROWS` on `listTickets`'s existing `findMany` call — the one
   deliberate behavior change even for an unfiltered call, exactly like
   Story 104's `MAX_AUDIT_LOG_ROWS`. Set higher than Story 104's `200`:
   confirmed directly against this session's own dev database that the
   single seeded branch already holds 991 tickets (accumulated e2e/test
   activity) — a cap chosen to comfortably cover realistic day-to-day
   team-scale ticket volume (a busy support team's open+recent-closed
   backlog) without being a routine, frequently-hit ceiling, while still
   bounding worst-case query cost. The exact number is a judgment call,
   documented here rather than left implicit.
2. **The DB fetch always requests `desc` order, regardless of the
   caller's requested `sortDir`; a requested `sortDir: "asc"` is restored
   by reversing the already-fetched, already-capped array in memory.**
   Discovered mid-implementation, via this story's own e2e run against
   the real dev database (991 existing tickets in one branch): capping a
   literal `sortDir: "asc"` query (the default) would fetch the
   **oldest** `MAX_TICKET_ROWS` rows, and once a branch ever exceeds the
   cap, freeze there forever — every ticket created afterward would
   silently never appear in the default, no-filter view. That is a real
   regression, not a hypothetical one, and the opposite of what a cap is
   for. Reversing a `desc`-fetched, capped array reproduces the exact
   `asc` list a direct query would have returned whenever the true row
   count is at or under the cap — so this is behavior-identical to
   before Story 105 for every branch that hasn't hit the cap yet, and
   correctly keeps the *most recent* `MAX_TICKET_ROWS` tickets (not the
   oldest) once a branch does exceed it.
3. **Frontend**: no change. `TicketListView` already renders whatever
   `useTicketsQuery` returns with no assumption of an exact total count;
   a capped response renders exactly like a smaller unfiltered result
   already would.

## Files expected to change

- `apps/api/src/modules/tickets/tickets.service.ts` — `MAX_TICKET_ROWS` + `take`.
- `apps/api/src/modules/tickets/tickets.service.spec.ts` — updated/new unit tests.
- `apps/api/test/tickets.e2e-spec.ts` — new e2e test proving the cap.

## Acceptance / Done Criteria

- `listTickets` never returns more than `MAX_TICKET_ROWS` rows, regardless
  of how many rows actually match.
- Every existing filter/sort/search combination behaves identically
  otherwise — the existing "scopes to branch, defaults to createdAt asc"
  unit test's `where`/`orderBy` expectations are unchanged, only `take`
  is newly asserted.
- `listTicketsForCustomer` is untouched.

## Verification Plan

- `apps/api` unit: updated `tickets.service.spec.ts` — then the full `pnpm --filter @crm/api test`.
- `apps/api` e2e: new cap-proving test in `tickets.e2e-spec.ts`, run in isolation first, then a full `pnpm --filter @crm/api test:e2e` sweep (accepting the pre-existing, documented environmental failures — realtime-presence, reporting historical-data date-boundary pollution — as unrelated).
- `pnpm --filter @crm/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `git status --short` / `git diff --stat` review before commit.
