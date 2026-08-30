# Story 68 — Ticket Department-Scoped Visibility (opt-in)

## Prerequisites

- `Role`/`TicketsService` already exist (Stories 02/07).

---

## Story Goal

Close the disclosed gap in `docs/architecture/05-auth-and-security.md`
("CASL handles fine-grained checks such as assignment and department
visibility") by letting an admin opt a role into department-scoped ticket
visibility, with the current, unrestricted branch-wide visibility
remaining the default for every existing role — explicitly confirmed with
the user as the resolution to an authorization-semantics design question
this session did not consider safe to decide unilaterally (see plan
Recon).

**Not in scope**: reassignment/update restrictions by department (a
separate, deferred concern); CASL as a library; a branch-switching UI;
changing any existing role's default.

---

## Context — Read These Files First

1. `apps/api/src/modules/identity/identity.service.ts` — `RoleSummary`,
   `createRole`/`updateRole` (the exact site the new field is threaded
   through), `issueAccessToken` (confirms exactly one active
   `branchId`+`departmentId` pair per session, and that `roles` already
   contains every role name matching that exact pair — the basis for the
   "most-permissive-wins across held roles" design decision).
2. `apps/api/src/modules/tickets/tickets.service.ts` — `listTickets`,
   `findTicketInScope` (used by `getTicket`/`updateTicket`/every ticket
   sub-resource) — the exact two sites the new department filter is added
   to.
3. `apps/api/src/common/tenant/tenant-context.ts` — `roles`/`departmentId`
   getters, already populated from the JWT, reused unchanged.
4. `apps/web/src/components/roles/*` — the exact Role management
   create/edit UI a new `ticketVisibilityScope` control is added to.

---

## Design decisions

1. **`Role.ticketVisibilityScope: TicketVisibilityScope` (`BRANCH` |
   `DEPARTMENT`), default `BRANCH`** — every existing/seeded role keeps
   today's exact behavior; the migration adds the column with its default,
   no data backfill needed.
2. **Filter logic lives in one new private `TicketsService` helper**,
   `resolveDepartmentVisibilityFilter()`: looks up
   `this.prisma.role.findMany({ where: { name: { in: tenantContext.roles } } })`,
   and returns `{}` (no extra filter) unless every returned role has
   `ticketVisibilityScope === "DEPARTMENT"` — in which case it returns
   `{ OR: [{ departmentId: tenantContext.departmentId }, { departmentId: null }] }`.
   Applied inside `listTickets`'s existing `where` object and
   `findTicketInScope`'s existing `where` object (both already build a
   `where` fragment from `TenantContext` — this is additive, not a
   restructure).
3. **No new permission key** — this is a visibility *restriction* on
   existing `ticket:read`/`ticket:update`, not a new capability, mirroring
   how `TenantContext.requireBranchScope()` itself is not gated by a
   separate permission.
4. **`CreateRoleDto`/`UpdateRoleDto` gain an optional
   `ticketVisibilityScope`** (`@IsOptional() @IsEnum(TicketVisibilityScope)`),
   defaulting server-side to `BRANCH` on create when omitted (matches the
   Prisma column default exactly, so a client that never sends the field
   sees identical behavior before and after this Story).
5. **Frontend: a `Select` (`BRANCH`/`DEPARTMENT`) added to the existing
   Role create/edit UI**, mirroring `KnowledgeBaseArticleStatus`'s own
   two-value-enum `Select` precedent — no new page, no new route.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — new `TicketVisibilityScope` enum
   (`identity` schema); `Role.ticketVisibilityScope` field, default
   `BRANCH`.
2. **Migration** — `add_role_ticket_visibility_scope`.
3. **`apps/api/src/modules/identity/dto/create-role.dto.ts`/
   `update-role.dto.ts`** — optional `ticketVisibilityScope`.
4. **`apps/api/src/modules/identity/identity.service.ts`** —
   `RoleSummary` gains `ticketVisibilityScope`; `createRole`/`updateRole`
   thread the new field through; `listRoles` returns it.
5. **`apps/api/src/modules/tickets/tickets.service.ts`** —
   `resolveDepartmentVisibilityFilter()`; applied in `listTickets` and
   `findTicketInScope`.
6. **Tests** — see Test Plan.

### Frontend

7. **`apps/web/src/lib/identity-api.ts`** (or wherever `RoleSummary`/
   `CreateRoleInput`/`UpdateRoleInput` live) — mirror the new field.
8. **`apps/web/src/components/roles/*`** — a `Select` for
   `ticketVisibilityScope` on the create/edit role UI.
9. **i18n** — `apps/web/messages/{en,ar}.json`: labels for the new field
   and its two values.
10. **Tests** — see Test Plan.

---

## API contract

- `POST/PATCH /identity/roles(/:id)` — optional `ticketVisibilityScope`
  (`"BRANCH"` default | `"DEPARTMENT"`); every other field/response shape
  unchanged.
- `GET /identity/roles` — each row gains `ticketVisibilityScope`.
- `GET /tickets`, `GET /tickets/:id`, and every `:id`-scoped ticket
  sub-resource — response shape unchanged; only which rows are
  *reachable* changes, and only for a session whose every held role (for
  the active branch+department) is `DEPARTMENT`-scoped.

## Tests

**Backend unit** (extend `tickets.service.spec.ts`): a `BRANCH`-scoped
role (or the default, no scope query at all needed to prove behavior
unchanged) sees every branch ticket, unfiltered — the exact pre-existing
assertion, proving zero regression; a session holding only
`DEPARTMENT`-scoped roles is filtered to `{ OR: [{departmentId: <theirs>},
{departmentId: null}] }`; a session holding a mix of `BRANCH`- and
`DEPARTMENT`-scoped roles gets full branch visibility (most-permissive-
wins); `findTicketInScope` (via `getTicket`) 404s for a
`DEPARTMENT`-scoped session requesting a ticket in a different department,
succeeds for one in their own department or with no department.

Extend `identity.service.spec.ts`: `createRole`/`updateRole` persist
`ticketVisibilityScope`; omitting it on create defaults to `BRANCH`;
`listRoles` returns it.

**Backend e2e** (extend `identity.e2e-spec.ts` and/or
`tickets.e2e-spec.ts`): create a `DEPARTMENT`-scoped role, a user holding
only that role in a specific department, two departments each with a
ticket, and an unassigned-department ticket — confirm the department-
scoped user's `GET /tickets` returns only their department's ticket and
the unassigned one, not the other department's; confirm every pre-existing
Agent-role (`BRANCH`-scoped by seed default) test keeps its current
full-branch-visibility behavior unchanged.

**Frontend component**: the new `Select` renders/submits correctly on
create and edit; every pre-existing Role-management test passes
unmodified.

## Regression requirements

Every existing test suite remains green, unweakened — especially every
ticket-listing/-detail test in `tickets.service.spec.ts` and
`tickets.e2e-spec.ts`, unmodified, since the default (`BRANCH`) must
reproduce today's exact behavior.

## Migration requirements

One new migration: a new enum + one new column with a default — additive,
no backfill, no existing row's effective behavior changes.

## Security risks/mitigations

- **Fails safe, not open**: an ambiguous/empty role-name lookup (e.g. a
  role renamed/deleted mid-session) resolves to `{}` (full branch
  visibility, today's behavior) rather than silently hiding everything —
  a visibility bug here should never look like "no tickets exist."
- **Never client-supplied**: the filter is built entirely from
  `TenantContext` (JWT-derived) and a server-side `Role` lookup — a
  request can never widen its own visibility by passing a parameter.
- **No behavior change without an explicit admin action**: every existing
  role, and every role created without specifying the new field, is
  `BRANCH`-scoped — identical to pre-Story-68 behavior.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] A role can be created/updated with `ticketVisibilityScope`; omitted
      defaults to `BRANCH`.
- [ ] A session whose every held role is `DEPARTMENT`-scoped sees only
      their own department's tickets plus unassigned ones; a session
      holding any `BRANCH`-scoped role sees the full branch, unchanged.
- [ ] Role management UI exposes the new field.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains
      green, unweakened — especially every existing ticket-visibility
      test, proving the default is regression-free.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short`
      clean before commit.

---

## Non-Goals (explicit)

- Reassignment/update restrictions by department.
- CASL as a library.
- A branch-switching UI.
- Changing any existing role's default scope.
- Any README change.
