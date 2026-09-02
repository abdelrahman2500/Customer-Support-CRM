> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/bounded-list-caps/bounded-list-caps/intake.md`

---

## Feature

- **Feature name (display):** Cross-cutting — Bounded Result Caps for Customers, Knowledge Base & Notifications
- **Feature slug (folder under `plans/`):** `bounded-list-caps`

## Title

```text
Story 106 — Cross-cutting: Bounded Result Caps for Customers, Knowledge Base & Notifications
```

## Description

```text
Stories 104/105 closed the unbounded-query-growth risk for AuditLog and
Ticket. This story extends the same fixed, documented take cap to the
three other confirmed branch-wide unbounded lists: listCustomers
(1182 rows in this session's dev DB - now the single largest unbounded
table), listArticles/listPublishedArticlesForBranch/searchArticles, and
listNotifications. listCustomers shares Story 105's exact asc/desc
correctness pitfall (same sortBy/sortDir shape, same default) and gets
the identical fetch-desc-then-reverse fix; the KB/notifications lists
already order by a fixed desc timestamp, so a plain take/LIMIT suffices
there.
```

## Acceptance criteria

```text
- [ ] MAX_CUSTOMER_ROWS = 500 on listCustomers, with the fetch-desc-
      then-reverse-in-memory fix for sortDir: "asc" (mirrors Story 105
      exactly).
- [ ] MAX_ARTICLE_ROWS = 200 applied via take on listArticles/
      listPublishedArticlesForBranch, and via LIMIT on both searchArticles
      raw SQL variants.
- [ ] MAX_NOTIFICATION_ROWS = 200 applied via take on listNotifications.
- [ ] No reversal logic needed for KB/notifications - their orderBy is
      already fixed-desc.
- [ ] listContacts, listArticleVersions, ChannelMessagesService.
      listForTicket, and NotificationsService.listNotificationsForCustomer
      are explicitly untouched (parent-scoped, deferred).
- [ ] New/updated tests across customers.service.spec.ts,
      knowledge-base.service.spec.ts, notifications.service.spec.ts, and
      corresponding e2e specs.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or
      its documented isolated-file fallback), pnpm --filter @crm/web
      test, pnpm typecheck, pnpm lint, and pnpm build all pass.
```

## Dependencies

- Story 104 — the fixed-cap design precedent.
- Story 105 — the fetch-desc-then-reverse fix for a configurable asc/desc sort.
- Story 101 — `ListCustomersQueryDto`'s `sortBy`/`sortDir`.
- Story 102 — `searchArticles`'s raw-SQL shape.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Pagination UI.
- Caps on parent-scoped lists (`listContacts`, `listArticleVersions`,
  `listForTicket`, `listNotificationsForCustomer`) — naturally bounded,
  deliberately deferred.
- Any change to filtering/search logic itself.
