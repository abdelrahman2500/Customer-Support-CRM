# bounded-list-caps — plan overview

Entry point for the **bounded-list-caps** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 106 | [106-story-bounded-list-caps.md](./106-story-bounded-list-caps.md) | Cross-cutting — Bounded Result Caps for Customers, Knowledge Base & Notifications | — | `audit-log-search` Story 104, `ticket-list-cap` Story 105 |

## Dependency notes

- Selected from the standing, user-approved backlog inventory (11
  unblocked / 8 blocked / 0 optional), via a fresh Recon dispatched right
  after Story 105 closed, per the user's explicit "fresh Recon after
  every Story, don't rely on stale ordering" instruction.
- **The gap, verified fresh against actual code (not just the prior
  Recon's description)**: eight unbounded `findMany`/raw-SQL list calls
  exist across `CustomersService`, `KnowledgeBaseService`,
  `ChannelMessagesService`, and `NotificationsService`. Of these, three
  are branch-wide/global lists carrying the exact same unbounded-growth
  risk Stories 104/105 already closed for `AuditLog`/`Ticket`:
  `CustomersService.listCustomers`, `KnowledgeBaseService.listArticles`/
  `listPublishedArticlesForBranch`/`searchArticles`, and
  `NotificationsService.listNotifications`. The other five
  (`listContacts`, `listArticleVersions`, `ChannelMessagesService.listForTicket`,
  `NotificationsService.listNotificationsForCustomer`) are scoped to one
  parent entity (a customer/article/ticket) and are naturally bounded by
  that entity's own realistic cardinality — deliberately deferred, see
  Non-Goals.
- **Confirmed against this session's own dev database**:
  `Customer` has **1182** rows in the single seeded branch — more than
  `Ticket` had when Story 105 was selected — making `listCustomers` this
  codebase's single highest-row-count unbounded list today.
  `NotificationLog` has 697; `KnowledgeBaseArticle` has 76 (lower
  immediate risk, capped anyway for consistency and future-proofing).
- **`CustomersService.listCustomers` shares Story 105's exact
  correctness pitfall**: it has the identical `sortBy: "createdAt" |
  "displayName"`, `sortDir: "asc" | "desc"` shape (Story 101), defaulting
  to `sortBy: "createdAt", sortDir: "asc"` — capping that default query
  naively would freeze on the oldest 500 customers forever, exactly like
  the bug Story 105 found and fixed for tickets. This story applies the
  identical fetch-`desc`-then-reverse-in-memory fix.
- **Why not externally blocked**: purely internal Postgres query work.
- **Dependency correctness**: builds only on infrastructure already in
  place — reuses Stories 104/105's own established, now-twice-proven
  cap pattern, applied to its next confirmed targets.
- **Architectural coherence**: no new abstraction — each service's own
  existing `findMany`/raw-SQL call gains a `take`/`LIMIT`, mirroring
  Stories 104/105 exactly; `KnowledgeBaseService`/`NotificationsService`'s
  lists have fixed, already-`desc` ordering, so no reversal logic is
  needed there — only `listCustomers` needs Story 105's full fix.
- **Product value / risk reduction**: `Customer` is now the single
  largest unbounded table in the codebase; closing this is the
  highest-leverage remaining item in that risk class.
- **Smallness**: three services, one cap constant each, no new model, no
  new endpoint, no new permission — deliberately scoped to the three
  confirmed branch-wide risks, not all eight `findMany` calls found.
