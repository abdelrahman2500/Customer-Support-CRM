# Story intake

- Folder: `.squad/stories/project-foundation/identity-seed-and-user-management/intake.md`
- Binaries (screenshots, PDFs, exports): none.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit.

---

## Feature

- **Feature name (display):** Project Foundation & System Architecture
- **Feature slug (folder under `plans/`):** `project-foundation`

This story continues the `project-foundation` feature (global sequence `NN=03`) rather than starting a new feature slug: it completes the Identity & Access domain that Story 02 scaffolded but left unusable, before any CRM business feature (Customer Management, Ticketing, ...) starts as its own feature slug.

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** _(none — not linked)_

---

## Title

```
Identity & Access — Seed Data, Bootstrap Admin, and User/Role Management
```

---

## Description

Story 02 built the full identity/auth/tenant foundation: the `identity` Prisma
schema (Organization → Branch → Department, User, Role, Permission,
RolePermission, UserBranchRole, RefreshToken), JWT access/refresh
authentication, `TenantContext`, `AuthGuard`, `PermissionsGuard` +
`@RequirePermissions`, and the append-only audit log.

None of it is usable yet: there is no organization/branch/department row,
no role or permission catalog, and no user in the database — so
`POST /api/v1/auth/login` has nothing to authenticate against, and
`PermissionsGuard` has never been exercised against a real permission grant.
There is also no way to create a second user once the first exists (no user
management endpoint at all).

This story closes that gap so the platform built in Story 02 can actually be
logged into, administered, and demonstrated — and so every future story
that needs "an authenticated user with a given permission" (which is nearly
all of them) has something to build against and test with.

This is still foundation/platform work, not a CRM feature: it does not touch
customers, tickets, channels, SLA, the Knowledge Base, AI, the portal,
reporting, or external integrations.

## Product rules

- **Current:** No way to seed an organization/branch/department, no
  permission catalog, no role, no user exists in the database. The only
  identity endpoints are `login`, `refresh`, `logout`, `me` (all Story 02).
- **New:** A reproducible seed script creates the first organization,
  branch(es), department(s), a permission catalog, baseline roles, and one
  bootstrap admin user. Authenticated, permission-checked endpoints exist to
  create additional users, list users, update/deactivate a user, and read
  the role/permission catalog.

---

## Acceptance criteria

```markdown
- [ ] A Prisma seed script exists, is idempotent (safe to re-run without
      duplicating or conflicting with existing data), and is wired through
      Prisma's standard `db seed` mechanism.
- [ ] Running the seed creates: one Organization; at least one Branch with
      an IANA timezone; at least one Department; a defined, finite
      permission catalog (`resource:action` keys, matching the convention
      already used in docs/architecture/05-auth-and-security.md); at least
      two Roles (e.g. a full-access administrative role and a baseline
      non-admin role) with sensible permission grants; and one bootstrap
      admin User who can immediately log in via the existing
      `POST /api/v1/auth/login`.
- [ ] Seed admin credentials are read from environment variables (never
      hardcoded), and those variables are documented in `.env.example`.
- [ ] `POST /api/v1/identity/users` creates a user scoped to a branch
      (and optionally a department) with a specified role; it is protected
      by a specific permission, validates its input via DTOs, hashes the
      password using the existing convention, and is captured by the
      existing global audit interceptor.
- [ ] `GET /api/v1/identity/users` lists users scoped to the caller's active
      branch (via the existing `TenantContext`), protected by a specific
      permission.
- [ ] `PATCH /api/v1/identity/users/:id` supports updating a user's display
      name and active/inactive status, protected by a specific permission.
- [ ] `GET /api/v1/identity/roles` lists roles together with their granted
      permission keys, protected by a specific permission.
- [ ] `GET /api/v1/identity/permissions` lists the permission catalog,
      protected by a specific permission.
- [ ] All new endpoints are documented via the existing Swagger/OpenAPI
      decorators (consistent with Story 02's auth endpoints).
- [ ] No new Prisma tables/schemas are introduced — only the existing
      `identity` schema tables from Story 02 are used.
- [ ] No branch, department, role, or permission mutation endpoints are
      added (they remain seed-managed in this story).
- [ ] No frontend/UI changes are required for this story to be complete.
- [ ] Story 02's existing behavior is unaffected: `login`/`refresh`/
      `logout`/`me`/`health`/`health/ready` continue to work exactly as
      before, and the full existing lint/typecheck/build/test suite still
      passes across every app and package.
- [ ] Any verification that requires a live database (running the seed
      against real Postgres, an end-to-end login test) is clearly documented
      as deferred if Docker/local infrastructure is unavailable at
      implementation time — this is not treated as a code defect.
```

---

## Attachments

| File (relative to this folder) | What it is     |
| ------------------------------ | -------------- |
| None                           | No attachments |

---

## Dependencies

- **Blocked by / related ids:** Story 02 (Monorepo & Environment Scaffolding) — completed. This story extends `apps/api`'s existing `IdentityModule`, `PrismaService`, `TenantContext`, `AuthGuard`/`PermissionsGuard`, and `AuditInterceptor` as built there; it does not re-architect any of them.

- **Depends on code areas or other stories:**
  `apps/api/prisma/schema.prisma` (existing `identity` schema — no changes
  expected), `apps/api/src/modules/identity/*` (extended),
  `apps/api/src/common/auth/*` (reused, not modified),
  `apps/api/src/prisma/*` (reused, not modified).

## Extra notes (optional)

- Branch/Department **listing** endpoints are deliberately **not** included
  in this story's scope (a caller creating a user needs to already know a
  valid branch/department id, which the seed script prints). Add them in
  whatever future story first needs them from a UI (likely an
  administration-screens story) rather than here.
- Role/Permission **management** (create/update/delete roles or
  permissions) is deliberately deferred — this story only reads the
  seed-managed catalog. A dedicated Administration feature can own
  role/permission CRUD later.
- Prefer extending the existing `IdentityModule`/`IdentityService` /
  splitting into small, focused files consistent with Story 02's existing
  module layout, rather than introducing a new top-level module for this.

## Technical hints (optional)

- Runtime/tooling: reuse Story 02's exact stack — NestJS, Prisma 6.19.3,
  `class-validator`/`class-transformer` DTOs, `bcryptjs` (already used by
  `IdentityService.hashPassword`), the existing `@RequirePermissions`
  decorator + `PermissionsGuard`.
- A seed script run via `prisma db seed` needs a TypeScript runner
  configured in `apps/api/package.json`'s `"prisma"."seed"` field (e.g.
  `tsx prisma/seed.ts`) — `tsx` is not yet a dependency of `apps/api` and
  would need to be added.
- Local infrastructure (Postgres/Redis/MinIO/MailHog via `docker-compose.yml`)
  may still be unavailable in this environment (Docker Desktop's engine was
  blocked by a broken WSL2 install during Story 02) — plan for that
  explicitly rather than assuming it will be fixed by the time this story is
  implemented.

## Out of scope

- Any customer management, ticketing, communication channel, SLA/automation,
  Knowledge Base, AI, customer portal, reporting, or integration feature.
- Frontend/UI screens for user, role, or permission management.
- Branch/department create/update/delete or listing endpoints.
- Role/permission create/update/delete endpoints.
- Password reset ("forgot password"), email verification, or SSO.
- Changes to the login/refresh/logout/me endpoints or the JWT/refresh-token
  design established in Story 02.
- Production deployment or live infrastructure provisioning.

```

```
