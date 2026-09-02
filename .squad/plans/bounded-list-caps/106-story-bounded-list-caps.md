# Story 106 — Cross-cutting: Bounded Result Caps for Customers, Knowledge Base & Notifications

## Prerequisites

- `audit-log-search` Story 104 — the fixed-`take`-cap design precedent.
- `ticket-list-cap` Story 105 — the fetch-`desc`-then-reverse-in-memory
  fix for a user-configurable `asc`/`desc` sort, reused verbatim for
  `listCustomers`.
- `customer-list-search` Story 101 — `ListCustomersQueryDto`'s
  `sortBy`/`sortDir` shape.
- `knowledge-base-fulltext-search` Story 102 — `searchArticles`'s raw-SQL
  shape, extended with a `LIMIT`.

All are complete and already merged to `main`.

## Story Goal

Apply the same fixed, documented result cap Stories 104/105 already
established to the next three confirmed branch-wide unbounded lists:
`CustomersService.listCustomers`, `KnowledgeBaseService.listArticles`/
`listPublishedArticlesForBranch`/`searchArticles`, and
`NotificationsService.listNotifications`.

## Non-Goals

- **No pagination UI** — same reasoning as Stories 104/105.
- **No cap on parent-scoped lists** (`listContacts`, `listArticleVersions`,
  `ChannelMessagesService.listForTicket`,
  `NotificationsService.listNotificationsForCustomer`) — each is bounded
  by one parent entity's own realistic cardinality (a customer's own
  contacts, one article's own version history, one ticket's own message
  thread, one customer's own notifications), not a branch-wide,
  ever-growing table. Deliberately deferred, not overlooked.
- **No change to filtering/search logic** in any of the three services —
  `ListCustomersQueryDto`, KB's `search` param, and `searchArticles`'s
  `websearch_to_tsquery`/`ts_rank` matching are all reused unmodified.

## Design decisions

1. **`CustomersService.listCustomers`** — `MAX_CUSTOMER_ROWS = 500`
   (matches Story 105's `Ticket` cap: `Customer` is now this codebase's
   single largest unbounded table, confirmed at 1182 rows in this
   session's dev database — a comparable operational scale to
   `Ticket`). Shares `ListCustomersQueryDto`'s exact `sortBy: "createdAt"
   | "displayName"`, `sortDir: "asc" | "desc"` shape Story 101 added,
   defaulting to `sortBy: "createdAt", sortDir: "asc"` — the identical
   correctness trap Story 105 found: capping that default naively would
   freeze on the *oldest* 500 customers forever. Fixed identically: the
   DB fetch always requests `desc` on the chosen `sortBy` field; a
   requested `sortDir: "asc"` reverses the already-fetched, already-capped
   array in memory (reproduces the exact pre-Story-106 order whenever the
   true row count is at or under the cap).

2. **`KnowledgeBaseService.listArticles`/`listPublishedArticlesForBranch`**
   — `MAX_ARTICLE_ROWS = 200` (KB articles are an authored content
   library, not a per-interaction record — far lower realistic volume
   than customers/tickets; 200 mirrors Story 104's own `AuditLog` cap
   for a similar "generous page for a human reader" rationale). Both
   methods already order by a fixed, already-`desc` timestamp
   (`updatedAt`/`publishedAt`) with no user-configurable direction — a
   plain `take: MAX_ARTICLE_ROWS` is sufficient, no reversal logic
   needed (unlike `listCustomers`/`listTickets`).

3. **`KnowledgeBaseService.searchArticles`** (Story 102's `$queryRaw`
   full-text path, used by both list methods above) — a `LIMIT
   ${MAX_ARTICLE_ROWS}` clause added to both of its raw SQL statements,
   after the existing `ORDER BY ts_rank(...) DESC`. Reuses the same
   constant as the two callers above — one cap for the whole "list
   articles" surface, plain or searched.

4. **`NotificationsService.listNotifications`** — `MAX_NOTIFICATION_ROWS
   = 200` (an agent-facing activity feed, the same "recent activity,
   not a full archive" semantics as `AuditLog` — 200 mirrors that
   precedent directly). Already orders by a fixed `loggedAt: "desc"` —
   plain `take`, no reversal logic needed.

## Files expected to change

- `apps/api/src/modules/customers/customers.service.ts` — `MAX_CUSTOMER_ROWS`, fetch-desc-then-reverse fix.
- `apps/api/src/modules/customers/customers.service.spec.ts` — new/updated unit tests.
- `apps/api/test/customers.e2e-spec.ts` — new e2e test proving the cap.
- `apps/api/src/modules/knowledge-base/knowledge-base.service.ts` — `MAX_ARTICLE_ROWS`, `take`/`LIMIT` on all three methods.
- `apps/api/src/modules/knowledge-base/knowledge-base.service.spec.ts` — new/updated unit tests.
- `apps/api/test/knowledge-base.e2e-spec.ts` — new e2e test proving the cap.
- `apps/api/src/modules/notifications/notifications.service.ts` — `MAX_NOTIFICATION_ROWS`, `take`.
- `apps/api/src/modules/notifications/notifications.service.spec.ts` — new/updated unit tests.
- `apps/api/test/notification-read-state.e2e-spec.ts` (or a dedicated notifications e2e file) — new e2e test proving the cap, if a real-DB proof is feasible without excessive fixture creation.

## Acceptance / Done Criteria

- None of the three branch-wide list methods (and `searchArticles`)
  ever return more rows than their own documented cap.
- `listCustomers` never silently freezes on stale data once a branch
  exceeds the cap — the most recent `MAX_CUSTOMER_ROWS` customers are
  always included, matching Story 105's own proven fix.
- Every existing filter/sort/search combination on all three services
  behaves identically otherwise; every currently-passing test for
  `listContacts`, `listArticleVersions`, `listForTicket`,
  `listNotificationsForCustomer` is untouched.

## Verification Plan

- `apps/api` unit: updated specs for all three services — then the full `pnpm --filter @crm/api test`.
- `apps/api` e2e: new cap-proving tests, run in isolation first, then a full `pnpm --filter @crm/api test:e2e` sweep (accepting the pre-existing, documented environmental failures as unrelated).
- `pnpm --filter @crm/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `git status --short` / `git diff --stat` review before commit.
