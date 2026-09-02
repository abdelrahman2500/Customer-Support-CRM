# Story 101 — Customer Management: List Search/Filter

## Prerequisites

- `customer-management` Story 06 — `Customer`/`Contact` models,
  `CustomersService.listCustomers`, `GET /customers` (`customer:read`).
- `ticketing` Story 23/70 — `ListTicketsQueryDto`, `searchWhereClause`,
  `TicketListView`'s filter-bar UX — the exact pattern this story mirrors
  field-for-field, per this Story's own selection mandate.

All are complete and already merged to `main`.

## Story Goal

Add search/filter/sort query parameters to `GET /customers`, mirroring
`GET /tickets`'s own exact pattern, and wire a filter bar into
`CustomerListView` mirroring `TicketListView`'s own.

## Non-Goals

- **No pagination.** No precedent anywhere in this codebase
  (`ListTicketsQueryDto`'s own doc comment: "No pagination — no precedent
  anywhere in this codebase to extend, and inventing one is explicitly out
  of scope") — unchanged by this story.
- **No search across `Contact` fields** (email/phone/fullName). Mirrors
  `ListTicketsQueryDto`'s own precedent exactly: `search` matches fields
  on the entity's own row (`subject`/`category` for `Ticket`), never a
  joined relation, even though `Ticket.customerId` could analogously have
  searched the customer's own `displayName` and does not. Extending
  search into `Contact` is a legitimate, larger future increment (a
  `some: { OR: [...] }` join), not a mechanical mirror of the existing
  pattern this story is scoped to.
- **No new permission.** Reuses the existing `customer:read` permission
  `GET /customers` already requires.
- **No full-text search / `tsvector`.** A plain `contains`/
  `mode: "insensitive"` filter, exactly like `Ticket`'s own `search`
  (`searchWhereClause`'s own doc comment: "not `tsvector` ... deferred").
- **No change to `GET /customers/:id`** (`getCustomer`) or to
  `CustomerListView`'s existing name/status columns.

## Design decisions

1. **New `ListCustomersQueryDto`**, in
   `apps/api/src/modules/customers/dto/list-customers-query.dto.ts`,
   mirroring `ListTicketsQueryDto`'s exact shape/validation style:
   ```ts
   export class ListCustomersQueryDto {
     @IsOptional() @IsString() search?: string;

     // Query-string params arrive as strings, never real booleans — this
     // codebase's own existing precedent for that
     // (`IdentityController.listBranches(@Query("includeInactive")
     // includeInactive?: string)`, compared manually as `=== "true"`) is
     // mirrored here via `@IsIn` (the same validated-string-literal
     // pattern `ListTicketsQueryDto.sortDir` already uses), not a new
     // `@Transform`-based boolean coercion this codebase has never used.
     @IsOptional() @IsIn(["true", "false"]) isActive?: "true" | "false";

     @IsOptional() @IsIn(["displayName", "createdAt"]) sortBy?: "displayName" | "createdAt";
     @IsOptional() @IsIn(["asc", "desc"]) sortDir?: "asc" | "desc";
   }
   ```

2. **`CustomersService.listCustomers(query: ListCustomersQueryDto = {})`**
   — defaults (`sortBy: "createdAt"`, `sortDir: "asc"`) reproduce the
   exact current, unparameterized query byte-for-byte for any caller that
   passes no query params (mirrors `ListTicketsQueryDto`'s own
   "reproduces this file's own pre-existing default" convention):
   ```ts
   async listCustomers(query: ListCustomersQueryDto = {}): Promise<CustomerSummary[]> {
     const { branchId } = this.tenantContext.requireBranchScope();
     const sortBy = query.sortBy ?? "createdAt";
     const sortDir = query.sortDir ?? "asc";
     const customers = await this.prisma.customer.findMany({
       where: {
         branchId,
         ...(query.search
           ? { displayName: { contains: query.search, mode: "insensitive" } }
           : {}),
         ...(query.isActive !== undefined ? { isActive: query.isActive === "true" } : {}),
       },
       orderBy: { [sortBy]: sortDir },
     });
     return customers.map(toCustomerSummary);
   }
   ```

3. **`CustomersController.list(@Query() query: ListCustomersQueryDto)`**
   — same route, same permission (`customer:read`), mirrors
   `TicketsController.list`'s exact `@Query() query: ListTicketsQueryDto`
   shape.

4. **Frontend**: `CustomerListView` gains a filter bar mirroring
   `TicketListView`'s own exact shape — a blur-commit `search` `Input`
   and an `isActive` `Select` (`ALL_VALUE` / `"true"` / `"false"`),
   plus clickable `displayName`/`createdAt` column headers for sort
   (mirrors `TicketListView`'s `toggleSort` on its header buttons).
   `useCustomersQuery(filters)` gains an optional `filters` param
   (`ListCustomersFilters`), included in its query key — mirrors
   `useTicketsQuery(filters)`'s own parameterized-query-key pattern.
   Every other existing caller of `useCustomersQuery()` (ticket-creation
   picker, `TicketListView`'s own customer-name lookup, etc.) keeps
   calling it with no arguments, reproducing today's exact all-customers
   query — the parameter is additive and optional.

## Files expected to change

**Backend**
- `apps/api/src/modules/customers/dto/list-customers-query.dto.ts` — new.
- `apps/api/src/modules/customers/customers.service.ts` — `listCustomers` gains filtering/sorting.
- `apps/api/src/modules/customers/customers.service.spec.ts` — new unit tests.
- `apps/api/src/modules/customers/customers.controller.ts` — `@Query()` on `list`.
- `apps/api/test/customers.e2e-spec.ts` — new e2e tests.

**Frontend**
- `apps/web/src/lib/tickets-api.ts` — `ListCustomersFilters`, `listCustomers(filters)`.
- `apps/web/src/hooks/use-tickets.ts` — `useCustomersQuery(filters)`.
- `apps/web/src/components/customers/customer-list-view.tsx` — filter bar + sortable headers.
- `apps/web/src/components/customers/customer-list-view.spec.tsx` — new tests.
- `apps/web/messages/{en,ar}.json` — new `customers.list.filter*`/`sort*` strings.

## Acceptance / Done Criteria

- `GET /customers` with no query params returns the exact same rows, in
  the exact same order, as before this story.
- `?search=<text>` filters to customers whose `displayName` contains
  `<text>`, case-insensitively; an unmatched search returns `[]`.
- `?isActive=true` / `?isActive=false` filters to only active/inactive
  customers; omitting it returns both.
- `?sortBy=displayName&sortDir=desc` (and every other combination) orders
  correctly; an invalid `sortBy`/`sortDir`/`isActive` value is rejected
  with `400` (the existing global `ValidationPipe`).
- Every filter/sort param stays scoped to the caller's own branch
  (`TenantContext.requireBranchScope()`, unchanged).
- `CustomerListView` renders the new filter bar and sortable headers;
  every existing "renders the customer list" test still passes unmodified.

## Verification Plan

- `apps/api` unit: new `listCustomers` filter/sort tests in
  `customers.service.spec.ts` — then the full `pnpm --filter @crm/api test`.
- `apps/api` e2e: new tests in `customers.e2e-spec.ts`, run in isolation
  first, then a full `pnpm --filter @crm/api test:e2e` sweep.
- `apps/web`: new `customer-list-view.spec.tsx` tests, then full
  `pnpm --filter @crm/web test`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `git status --short` / `git diff --stat` review before commit.
