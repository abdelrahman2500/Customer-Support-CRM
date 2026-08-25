# Story 03 — Identity & Access: Seed Data, Bootstrap Admin, and User/Role Management

## Prerequisites

- [Story 02 completed](./02-story-monorepo-scaffolding.md): the `identity` Prisma schema, JWT auth (login/refresh/logout/me), `TenantContext`, `AuthGuard`, `PermissionsGuard` + `@RequirePermissions`, and the global `AuditInterceptor` all exist in `apps/api` exactly as documented in that story's report. This story extends them; it does not redesign them.

---

## Story Goal

Make the identity/auth/tenant foundation from Story 02 actually usable:

1. A reproducible, idempotent seed script populates the first `Organization` → `Branch` → `Department`, a permission catalog, baseline roles, and one bootstrap admin `User` — so `POST /api/v1/auth/login` has something real to authenticate against.
2. Authenticated, permission-checked endpoints let that admin create further users, list users in their branch, update/deactivate a user, and read the role/permission catalog — so access to the platform can be administered without touching the database by hand.

No CRM feature (customers, tickets, channels, SLA, KB, AI, portal, reporting, integrations) is touched. No new Prisma tables are introduced — this story only puts data into and adds API surface over the tables Story 02 already created.

---

## Context — Read These Files First

1. [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) — confirms Identity & Access (`identity` schema: branches, departments, users, roles, permissions, sessions) is the domain this story completes.
2. [docs/architecture/05-auth-and-security.md](../../../docs/architecture/05-auth-and-security.md) — the `resource:action` permission-key convention (e.g. `ticket:reassign`) this story's new permission catalog must follow; audit-logging expectations for mutating requests (already enforced globally, see file 6 below).
3. [docs/architecture/04-data-and-multitenancy.md](../../../docs/architecture/04-data-and-multitenancy.md) — the `TenantContext`/branch-scoping model new list/create endpoints must respect.
4. `apps/api/prisma/schema.prisma` — the exact `identity`-schema models to seed and query: `Organization`, `Branch`, `Department`, `User`, `Role`, `Permission`, `RolePermission`, `UserBranchRole`. **Do not add new models** — every field this story needs already exists.
5. `apps/api/src/modules/identity/identity.service.ts` — reuse `hashPassword` (bottom of file) for the seed script and the new create-user endpoint; follow its existing style (constructor-injected `PrismaService`/`ConfigService`, methods returning shaped DTOs, `UnauthorizedException`/`ForbiddenException` usage patterns).
6. `apps/api/src/modules/identity/identity.controller.ts` and `identity.module.ts` — existing controller/module shape (`@ApiTags`, `@Controller('auth')`, providers/exports) to match when adding the new controller(s) in this story.
7. `apps/api/src/common/auth/require-permissions.decorator.ts` and `permissions.guard.ts` — reuse exactly as-is; `PermissionsGuard` already resolves permissions fresh from the DB via `roles: { some: { role: { name: { in: user.roles } } } }` — new endpoints just need `@RequirePermissions('...')`, no guard changes.
8. `apps/api/src/common/audit/audit.interceptor.ts` — already global (`APP_INTERCEPTOR` in `app.module.ts`) and logs every `POST`/`PUT`/`PATCH`/`DELETE`; **no new audit code is needed**, only confirm new mutating routes are covered (they will be, automatically).
9. `.env.example` (repo root) and `apps/api/.env` — add the new `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` variables here, following the existing format.
10. `.squad/plans/project-foundation/02-story-monorepo-scaffolding.md` — Phase 3's task breakdown, for file-layout and tone consistency (this story should read like a natural continuation, not a different style of codebase).

---

## Product rules (from story)

- **Current:** No organization/branch/department row exists; no permission or role exists; no user exists. The only identity endpoints are `login`, `refresh`, `logout`, `me`.
- **New:** A seed script creates the first organization/branch/department, a permission catalog, baseline roles, and a bootstrap admin user. New endpoints allow creating/listing/updating users and reading the role/permission catalog, all permission-checked.

---

## Implementation Tasks

### 1 — Permission catalog and seed script

Add `tsx` as a dev dependency of `apps/api` (`pnpm --filter @crm/api add -D tsx`) — needed to run the TypeScript seed file via Prisma's seed mechanism.

`File: apps/api/package.json` — add:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "scripts": {
    "prisma:seed": "prisma db seed"
  }
}
```

(Merge into the existing `scripts`/root object — do not remove any existing script.)

Create file: `apps/api/prisma/seed.ts`

Structure it as:

```typescript
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/modules/identity/identity.service";

const prisma = new PrismaClient();

// resource:action — see docs/architecture/05-auth-and-security.md.
// Keep this list the single source of truth for permission keys; the
// `identity.permissions` table is derived from it, not the other way round.
const PERMISSION_CATALOG = [
  "user:create",
  "user:read",
  "user:update",
  "role:read",
  "permission:read",
] as const;

const ROLE_GRANTS: Record<string, readonly string[]> = {
  SuperAdmin: PERMISSION_CATALOG,
  Agent: [], // no admin permissions yet — ticketing/etc. permissions land with those future stories
};

async function main() {
  // 1. Organization / Branch / Department — upsert by a stable natural key
  //    (name) so re-running the seed never duplicates rows.
  const organization = await prisma.organization.upsert({
    where: { /* Organization has no unique field but id; add a findFirst+create
                fallback here since `name` isn't unique in the schema — see
                note below */ },
    ...
  });
  // ... branch, department (same upsert-by-name-or-findFirst pattern)

  // 2. Permission catalog — upsert each key.
  for (const key of PERMISSION_CATALOG) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  // 3. Roles + RolePermission grants — upsert role by unique `name`, then
  //    reconcile its RolePermission rows to exactly match ROLE_GRANTS.

  // 4. Bootstrap admin user — read SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
  //    from process.env (throw a clear error if either is missing — do not
  //    default to a hardcoded password), upsert by `email`, hash via
  //    `hashPassword`, and create/update its UserBranchRole to SuperAdmin
  //    in the seeded branch/department.

  // 5. console.log the created organization/branch/department/user ids —
  //    this is the only way an operator learns them, since this story does
  //    not add branch/department listing endpoints (see intake's "Extra notes").
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

**Notes for the implementer:**

- `Organization` has no unique field other than `id` in the current schema — use `findFirst` + conditional `create` (not `upsert`) for `Organization`, `Branch`, and `Department`, keyed on `name` (and `organizationId`/`branchId` respectively) to keep the script idempotent. `Permission.key`, `Role.name`, and `User.email` **are** unique, so those three can use real `upsert`.
- `hashPassword` is already exported from `identity.service.ts` (Story 02) — import and reuse it verbatim; do not reimplement password hashing here.
- Fail loudly (non-zero exit) if `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are missing — this mirrors the fail-fast convention already used by `apps/api/src/common/config/env.validation.ts`.
- Reconciling `RolePermission` rows on every run (delete-then-recreate for that role, inside a single `prisma.$transaction`) is simplest and keeps the catalog exactly in sync with `ROLE_GRANTS` even if it changes between seed runs.

Add to `.env.example` and `apps/api/.env`:

```bash
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="change-me-locally-32chars-minplus"
```

### 2 — DTOs

Create file: `apps/api/src/modules/identity/dto/create-user.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(8) password!: string;
  @ApiProperty() @IsString() fullName!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() departmentId?: string;
  @ApiProperty() @IsUUID() roleId!: string;
}
```

Create file: `apps/api/src/modules/identity/dto/update-user.dto.ts`

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() fullName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}
```

### 3 — Service methods

`File: apps/api/src/modules/identity/identity.service.ts` — add methods (alongside the existing `login`/`refresh`/`revoke`/`getAuthenticatedUser`):

- `createUser(dto: CreateUserDto): Promise<{ id: string; email: string }>` — check `email` isn't already taken (throw a clear `ConflictException` if it is — import from `@nestjs/common`), hash the password with the existing private pattern (reuse the module-level `hashPassword` export, or inline `bcrypt.hash` at the same `BCRYPT_ROUNDS` constant already defined in this file — **do not introduce a second rounds constant**), create the `User` + its `UserBranchRole` in one `prisma.$transaction`.
- `listUsers(branchId: string): Promise<Array<{ id, email, fullName, isActive, roles: string[] }>>` — scoped by `branchId` via the `UserBranchRole` relation; this is the first real consumer of `TenantContext.requireBranchScope()` (added in Story 02 but unused until now) — inject `TenantContext` into `IdentityService`'s constructor (it's request-scoped, so `IdentityService` becomes request-scoped too — confirm this doesn't break the existing `login`/`refresh`/`me` methods, which don't need tenant scope; if request-scoping the whole service is undesirable, inject `TenantContext` directly into the new controller methods instead and pass `branchId` into the service methods as a parameter, matching the signature shown here).
- `updateUser(id: string, dto: UpdateUserDto): Promise<{ id: string }>` — `prisma.user.update`; throw `NotFoundException` if the id doesn't exist.
- `listRoles(): Promise<Array<{ id, name, permissions: string[] }>>`.
- `listPermissions(): Promise<Array<{ id, key }>>`.

### 4 — Controller

Extend `apps/api/src/modules/identity/identity.controller.ts` (keep `auth/*` routes as they are) **or** add a sibling `apps/api/src/modules/identity/users.controller.ts` mounted at `@Controller("identity")` — prefer the sibling-controller split since `auth` and `identity` (user management) are different concerns sharing one module, matching the existing file-per-concern style in `common/auth/`.

Routes (all under `/api/v1/identity` given `@Controller("identity")`):

```typescript
@Post("users")
@RequirePermissions("user:create")
create(@Body() dto: CreateUserDto) { ... }

@Get("users")
@RequirePermissions("user:read")
list(@Req() request: Request) { ... } // read branchId from request.user (JwtAccessTokenClaims)

@Patch("users/:id")
@RequirePermissions("user:update")
update(@Param("id") id: string, @Body() dto: UpdateUserDto) { ... }

@Get("roles")
@RequirePermissions("role:read")
roles() { ... }

@Get("permissions")
@RequirePermissions("permission:read")
permissions() { ... }
```

Register the new controller (and `TenantContext`/`IdentityService` as needed) in `apps/api/src/modules/identity/identity.module.ts`.

### 5 — No schema changes

Do **not** edit `apps/api/prisma/schema.prisma`. If implementation reveals a genuinely missing field, stop and report it (the same way Story 02's refresh-token gap was reported) rather than silently extending the schema.

---

## Verification Steps

1. **Install:** `pnpm install` (only adds `tsx` to `apps/api`'s devDependencies).
2. **Prisma:** `pnpm --filter @crm/api prisma:validate` — schema is unchanged, should still pass exactly as in Story 02.
3. **Typecheck/build/lint:** `pnpm --filter @crm/api typecheck`, `pnpm --filter @crm/api build`, `pnpm --filter @crm/api lint` — then the same three across the whole workspace (`pnpm typecheck`, `pnpm build`, `pnpm lint`) to catch any regression in `apps/web`/`apps/portal`/`apps/worker`/`packages/*` (none are expected to be touched by this story).
4. **Regression:** re-run `apps/api`'s existing boot smoke test from Story 02 (`node dist/main.js` with no live DB) and confirm `login`/`refresh`/`logout`/`me`/`health`/`health/ready` routes still appear in the Nest route log unchanged, plus the five new `identity/*` routes.
5. **If Docker/local Postgres is available:**
   - `docker compose up -d postgres redis`
   - `pnpm --filter @crm/api prisma:migrate` (first real migration, if not already applied from Story 02)
   - `pnpm --filter @crm/api prisma:seed`, then re-run it a second time and confirm it does not error or duplicate rows (idempotency check)
   - `curl -X POST http://localhost:3001/api/v1/auth/login` with the seeded `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` → expect `200` with an `accessToken`
   - Using that token: `POST /api/v1/identity/users`, `GET /api/v1/identity/users`, `PATCH /api/v1/identity/users/:id`, `GET /api/v1/identity/roles`, `GET /api/v1/identity/permissions` → expect `200`/`201` and correct data; retry one of them with no `Authorization` header → expect `401`; retry as a user with the `Agent` role (no permissions) → expect `403`.
6. **If Docker/local Postgres is unavailable:** document step 5 as deferred (exactly as Story 02's report did for its own Phase 7/10) — this is an infrastructure gap, not a reason to mark the story failed.

## Done Criteria

- [ ] Seed script exists, is idempotent, and creates the organization/branch/department/permission-catalog/roles/bootstrap-admin described above.
- [ ] Seed admin credentials come from env vars documented in `.env.example`.
- [ ] `POST /api/v1/identity/users`, `GET /api/v1/identity/users`, `PATCH /api/v1/identity/users/:id`, `GET /api/v1/identity/roles`, `GET /api/v1/identity/permissions` all exist, are permission-checked, DTO-validated, and documented via Swagger.
- [ ] No new Prisma models/schemas were introduced.
- [ ] No branch/department/role/permission mutation endpoints were added.
- [ ] No frontend changes were made.
- [ ] Full existing lint/typecheck/build/test suite still passes with no regressions in Story 02's endpoints or in `apps/web`/`apps/portal`/`apps/worker`.
- [ ] Live-infrastructure verification (step 5 above) is either completed and reported, or explicitly documented as deferred with the reason.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
