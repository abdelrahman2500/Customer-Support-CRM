# ticket-list-cap — plan overview

Entry point for the **ticket-list-cap** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 105 | [105-story-ticket-list-cap.md](./105-story-ticket-list-cap.md) | Ticketing — List a Bounded Result Cap | — | `ticketing` Stories 23/70, `audit-log-search` Story 104 |

## Dependency notes

- Selected from the standing, user-approved backlog inventory (11 unblocked
  candidates, 8 blocked, 0 optional) produced by a dedicated whole-repository
  Recon after Story 104 closed. Ranked "High" priority in that inventory and
  chosen as the next Story over the other three "High" candidates (Branch
  creation Story 107, structured-logging Story 111, Playwright E2E Story
  114) on architectural coherence and risk grounds: it is the smallest,
  most directly precedented of the four (an exact continuation of Story
  104's own just-established pattern, zero new dependencies), while
  Story 111 would introduce a new cross-cutting package (`pino`) touching
  both `apps/api` and `apps/worker` bootstrap, and Story 114 would stand
  up this repository's first browser-driven E2E harness — both
  legitimately larger, riskier first steps than extending an
  already-proven convention to its next natural target.
- **The gap**: `TicketsService.listTickets` runs a fully unbounded
  `prisma.ticket.findMany` — no `take` anywhere in the method. Confirmed
  directly against this session's own dev database: **991 rows** in the
  single seeded branch already (accumulated test/e2e activity), meaning
  `GET /tickets` with no filters already returns essentially the entire
  table today. `Ticket` is this application's highest-write-volume table
  (every ticket creation, update, and status transition touches it) —
  exactly the same unbounded-growth risk class Story 104 just closed for
  `AuditLog`, now on this codebase's single most active table.
- **Why not externally blocked**: purely internal Postgres query work.
- **Dependency correctness**: builds only on infrastructure already fully
  in place — `ListTicketsQueryDto`/`resolveSearchAndVisibilityFilter`
  (Stories 23/70) — reused verbatim, no change to filtering itself.
- **Architectural coherence**: mirrors Story 104's own exact design
  decision (a fixed, documented `take` cap; no pagination UI; narrowing
  via existing filters is the tool for "I need to see more") — the same
  precedent, applied to its next natural, already-identified target.
- **Product value / risk reduction**: Ticketing is the core of this CRM;
  an unbounded query against its busiest table is the single highest-
  leverage remaining latent-cost risk in the whole backlog inventory.
- **Smallness**: one cap constant, one field added to one existing
  `findMany` call, no new model, no new endpoint, no new permission.
