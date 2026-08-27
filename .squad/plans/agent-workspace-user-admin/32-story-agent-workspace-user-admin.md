# Story 32 — Agent Workspace: User Management (list, deactivate, rename)

## Prerequisites

- `project-foundation` Story 03 completed: `UsersController` (`GET/POST/PATCH /identity/users`, `GET /identity/roles`/`permissions`), `user:read`/`user:update` permissions.
- `agent-workspace-ticket-operations-mvp` Story 23 completed: `useUsersQuery`/`listUsers` already exist and are already consumed (the ticket assignee dropdown) — reused, not reimplemented.

---

## Story Goal

Give the Agent Workspace a real user management screen — list, inline rename, inline activate/deactivate — over the already-existing `UsersController` endpoints, as an entirely new, independent route/component surface. **User creation is explicitly excluded.**

**Not in scope**: user creation (blocked on a missing branch/department-listing endpoint — see Design item 4), role/permission management, password reset, audit log viewing, a persistent cross-screen navigation menu, any new backend endpoint/DTO/permission/model/migration.

---

## Context — Read These Files First

1. `apps/api/src/modules/identity/users.controller.ts` and `identity.service.ts` — confirmed this planning pass: `UserSummary { id, email, fullName, isActive, roles: string[] }` (the backend already returns `isActive`/`roles`; the frontend's own `UserSummary` type just never included them); `UpdateUserDto { fullName?, isActive? }` — no role/branch change possible through this endpoint.
2. `apps/api/src/modules/identity/dto/create-user.dto.ts` — confirmed `CreateUserDto` requires `branchId!`/`roleId!`; confirmed (via full inspection of `apps/api/src/modules/identity/**`) that no `GET /identity/branches` or `GET /identity/departments` endpoint exists anywhere — the concrete reason creation is out of scope.
3. `apps/web/src/lib/tickets-api.ts` — the existing (narrower) `UserSummary` type and `listUsers()`, already consumed by `ticket-list-view.tsx`/`ticket-detail-view.tsx`/`create-ticket-view.tsx`'s assignee dropdowns — widened, not replaced.
4. `apps/web/src/components/tickets/ticket-list-view.tsx` — the list/table conventions this story's list mirrors.
5. `apps/web/src/components/tickets/ticket-detail-view.tsx` — the inline blur-commit field pattern and `actionForbidden`/`actionFailed` distinction this story's rename/deactivate actions mirror.

---

## Design (resolved during this planning pass)

1. **A new top-level route**, `/users` — matching the existing flat `/tickets`, `/customers` URL convention.
2. **List with inline actions**, not list + separate detail page: each row shows email (read-only), an inline-editable `fullName` (blur-commit `Input`), roles (read-only badges — no mutation endpoint exists for role assignment), and an active/inactive toggle.
3. **Never optimistic**: rename and activate/deactivate each invalidate `["users"]` only after a real success response — identical convention to every existing mutation.
4. **User creation excluded, concretely justified**: `CreateUserDto` requires a real `branchId`/`roleId`; confirmed this turn that no endpoint exists anywhere to list valid branches/departments for a frontend form to populate. Building a creation form today would mean either hardcoding/guessing an id (unsafe, violates "never invent behavior") or blocking this story on a new backend endpoint (against the batch's "no new backend work" rule) — so creation is deferred, not attempted.
5. **`UserSummary` widened additively** in the shared `tickets-api.ts` to include `isActive`/`roles` (already returned by the backend) — every existing consumer only destructures `id`/`fullName` and is unaffected.

### Parallel-batch overlap note

This story is developed in parallel with Story 31 (`agent-workspace-sla-policy-admin`, zero overlap — dedicated new files) and Story 30 (`agent-workspace-customer-editing`). **Story 30 also makes small, additive changes to `apps/web/src/lib/tickets-api.ts` and `apps/web/src/hooks/use-tickets.ts`** (new Customer/Contact functions/mutations) — this is the only file overlap in the whole batch, identical in nature to the note in Story 30's own plan. Both stories' additions are new, distinctly-named exports; a trivial textual merge, not a logical conflict, is expected if both land close together.

---

## Implementation Tasks

### 1 — Widen the shared `UserSummary` type + add `updateUser`

File: `apps/web/src/lib/tickets-api.ts`

- `UserSummary` gains `isActive: boolean`, `roles: string[]` (additive).
- `updateUser(id: string, input: UpdateUserInput): Promise<{ id: string }>` — `PATCH /identity/users/:id`; `UpdateUserInput { fullName?, isActive? }`.

### 2 — Hook

File: `apps/web/src/hooks/use-tickets.ts`

- `useUpdateUserMutation(id)` — never-optimistic, invalidating `["users"]` on success. `useUsersQuery` (existing) is reused unmodified for the list itself.

### 3 — List view

File: `apps/web/src/components/users/user-list-view.tsx` (new) + `apps/web/src/app/[locale]/(agent)/users/page.tsx` (new)

- Loading/error/empty/populated states mirroring `TicketListView`'s conventions.
- Inline-editable `fullName`; an active/inactive toggle; roles rendered read-only.

### 4 — i18n

New top-level `users.*` namespace in `apps/web/messages/{en,ar}.json` (list/columns/errors/active-inactive labels — exact keys decided at implementation time, following established naming style).

### 5 — Tests

New `user-list-view.spec.tsx`, mirroring `ticket-list-view.spec.tsx`'s conventions; rename/deactivate success and 403/generic-failure states.

---

## Edge Cases & Failure Modes

- **A rename or activate/deactivate is rejected**: the field/toggle reverts to its last known-good value with an inline message — never assumed to have succeeded.
- **An agent deactivates their own account**: no special-casing is invented — the existing backend/session behavior (if any) governs; this story does not add a self-protection guard that doesn't already exist server-side.
- **No users exist** (should not occur given the seeded SuperAdmin, but handled defensively): empty-state paragraph, not an error.

---

## Test Plan

1. **Unit/component**: as listed in Implementation Task 5.
2. **Regression**: full existing `apps/web` suite remains green, in particular every `ticket-*` spec that consumes `UserSummary` (the widening is additive and backward-compatible). `apps/api`/`apps/worker` unaffected — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change. Rollback is a plain code revert.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): real `GET /identity/users`, real `PATCH /identity/users/:id` (rename and/or deactivate) against real seeded data, re-fetched to confirm persistence.
4. `pnpm --filter @crm/api test:e2e` — regression only.
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, `TicketListView`, `TicketDetailView`, `CustomerDetailView`, `DashboardView` have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] `/users` lists every real user in the branch via the real `GET /identity/users`.
- [ ] `fullName` is editable inline and persists via the real `PATCH /identity/users/:id`.
- [ ] Active/inactive state is toggleable inline and persists via the same endpoint.
- [ ] No user-creation UI exists anywhere on this screen.
- [ ] No mutation is ever applied optimistically.
- [ ] No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or business rule.
- [ ] `RealtimeGateway` and listeners, every SLA-policies file, `schema.prisma`, migrations, `TicketListView`, `TicketDetailView`, `CustomerDetailView`, `DashboardView` remain byte-for-byte unchanged.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass; existing tests remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
