> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/customer-list-search/customer-list-search/intake.md`

---

## Feature

- **Feature name (display):** Customer Management — List Search/Filter
- **Feature slug (folder under `plans/`):** `customer-list-search`

## Title

```text
Story 101 — Customer Management: List Search/Filter
```

## Description

```text
CustomerListView's own doc comment discloses the gap: "no search/
pagination ... CustomersController has no query parameters of any kind."
This story adds search/isActive-filter/sort query params to GET
/customers, mirroring ListTicketsQueryDto/searchWhereClause (Stories
23/70) field-for-field, and wires a matching filter bar into
CustomerListView mirroring TicketListView's own.
```

## Acceptance criteria

```text
- [ ] New ListCustomersQueryDto: search?, isActive? ("true"|"false"),
      sortBy? ("displayName"|"createdAt"), sortDir? ("asc"|"desc").
- [ ] CustomersService.listCustomers(query) applies search (displayName
      contains, case-insensitive), isActive equality, and sort; defaults
      reproduce today's exact unparameterized query/order.
- [ ] CustomersController.list(@Query() query: ListCustomersQueryDto) —
      same route, same customer:read permission, still branch-scoped via
      TenantContext.
- [ ] apps/web: ListCustomersFilters, listCustomers(filters),
      useCustomersQuery(filters) (optional, additive — every existing
      no-arg caller unaffected), a filter bar (search Input + isActive
      Select) and sortable displayName/createdAt headers in
      CustomerListView, mirroring TicketListView's own exact shapes.
- [ ] New/updated tests: customers.service.spec.ts, customers.e2e-spec.ts,
      customer-list-view.spec.tsx.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or its
      documented isolated-file fallback), pnpm --filter @crm/web test,
      pnpm typecheck, pnpm lint, and pnpm build all pass.
```

## Dependencies

- Story 06 — `customer-management` (`Customer`/`Contact` models,
  `CustomersService.listCustomers`, `GET /customers`).
- Stories 23/70 — `ListTicketsQueryDto`/`searchWhereClause`/
  `TicketListView` (the exact pattern mirrored here).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Pagination — no precedent anywhere in this codebase.
- Searching `Contact` fields (email/phone/fullName) — `search` matches
  only `Customer.displayName`, mirroring `Ticket.search`'s own
  entity-own-fields-only precedent.
- A new permission — reuses `customer:read`.
- Full-text search / `tsvector` — plain `contains`, mirroring `Ticket`'s
  own deferred-tsvector precedent.
