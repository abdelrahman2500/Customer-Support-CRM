# customer-list-search — plan overview

Entry point for the **customer-list-search** feature. Stories execute in
order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 101 | [101-story-customer-list-search.md](./101-story-customer-list-search.md) | Customer Management — List Search/Filter | — | `customer-management` Story 06 (`Customer`/`Contact` models, `GET /customers`), `ticketing` Story 23/70 (`ListTicketsQueryDto`/`searchWhereClause` — the exact pattern this story mirrors) |

## Dependency notes

- Selected via the same whole-repository Recon that produced
  `reporting-resolution-time-metrics` (Story 99) and
  `identity-security-hardening` (Story 100) — third-ranked of the four
  candidates surfaced, next per that Recon's own sequencing.
- **Why this, over Knowledge Base full-text search:** applying the same
  8-point ranking (dependency value > user-facing value > domain
  completeness > unblocking > security > testability > no external
  dependency > bounded size), this and KB search were close — Customer
  list search was sequenced first because it is a smaller, more directly
  precedented change (an exact structural mirror of already-shipped
  `ListTicketsQueryDto`/`searchWhereClause`, Stories 23/70), while KB
  full-text search requires a new Postgres `tsvector` migration and index
  — legitimately more work — and was queued as Story 102 instead.
- **The gap**: `CustomerListView`'s own doc comment already discloses it —
  *"Mirrors `TicketListView`'s structure exactly, minus filters/sort (plan
  Design item 4 — no search/pagination, matching the Ticket List's own
  existing, accepted limitation; `CustomersController` has no query
  parameters of any kind)."* `GET /customers` takes zero query parameters
  today; an organization with more than a handful of customers has no way
  to find one without scrolling the full, unfiltered list.
- **Dependency correctness**: builds only on infrastructure already fully
  in place — `CustomersService.listCustomers`/`CustomersController`
  (Story 06) and the `ListTicketsQueryDto`/`searchWhereClause`/
  `TicketListView` filter-bar pattern (Stories 23/70) this story mirrors
  field-for-field. No new route, no new permission.
- **Architectural coherence**: a new `ListCustomersQueryDto` alongside the
  existing `CreateCustomerDto`/`UpdateCustomerDto`, mirroring
  `ListTicketsQueryDto`'s exact shape and validation style
  (`@IsOptional`/`@IsIn`/`@IsString`) — no new abstraction invented.
- **Product value**: the most commonly needed operation on any
  people/organization list this codebase doesn't yet have for Customers,
  despite having had it for Tickets since Story 23/70 and for the
  Knowledge Base since Story 64.
- **Risk reduction**: none specific; purely additive (new optional query
  params, existing route/permission unchanged for every caller that
  doesn't use them).
- **Smallness**: bounded to one new DTO, filter/sort logic in one existing
  service method, one new frontend filter bar mirroring `TicketListView`'s
  own — no new model, no new migration, no new permission.
