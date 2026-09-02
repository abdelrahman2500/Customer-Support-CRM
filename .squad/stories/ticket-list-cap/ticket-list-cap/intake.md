> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/ticket-list-cap/ticket-list-cap/intake.md`

---

## Feature

- **Feature name (display):** Ticketing — List a Bounded Result Cap
- **Feature slug (folder under `plans/`):** `ticket-list-cap`

## Title

```text
Story 105 — Ticketing: List a Bounded Result Cap
```

## Description

```text
TicketsService.listTickets runs a fully unbounded findMany - no take
anywhere in the method. Confirmed directly against this session's own
dev database: 991 rows in the single seeded branch already. Ticket is
this application's highest-write-volume table - the same unbounded-
growth risk class Story 104 just closed for AuditLog. This story applies
the same fixed, documented take cap (MAX_TICKET_ROWS = 500, set higher
than Story 104's 200 given the confirmed real volume) to listTickets.
```

## Acceptance criteria

```text
- [ ] New MAX_TICKET_ROWS = 500 constant in tickets.service.ts.
- [ ] listTickets's existing findMany gains take: MAX_TICKET_ROWS,
      unconditionally, alongside its existing where/orderBy/include -
      no other change to the query construction.
- [ ] Every existing filter/sort/search combination behaves identically
      otherwise.
- [ ] listTicketsForCustomer (portal) is untouched.
- [ ] New/updated tests: tickets.service.spec.ts, tickets.e2e-spec.ts.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or
      its documented isolated-file fallback), pnpm --filter @crm/web
      test, pnpm typecheck, pnpm lint, and pnpm build all pass.
```

## Dependencies

- Stories 23/70 — `ListTicketsQueryDto`/`resolveSearchAndVisibilityFilter`.
- Story 104 — the exact bounded-cap design precedent this story applies.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Full pagination (page controls, cursor) — same reasoning as Story 104.
- `listTicketsForCustomer` — no comparable risk at single-customer scope.
- Any change to filtering/sorting/search logic itself.
- A new permission or endpoint.
