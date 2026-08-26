> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.
>
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/project-foundation/identity-test-suite-and-ci-integration/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Identity & Access — Automated Testing & CI Integration

- **Feature slug (folder under `plans/`):** `identity-test-suite-and-ci-integration`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** ``

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

**Identity & Access: Automated Test Suite and CI-Verified Database Integration**

---

## Description

Story 04 adds a real automated test suite for the Identity & Access module implemented in Stories 02–03 and completes the deferred live-database verification through CI.

The implementation must provide:

1. Unit tests for `IdentityService` business logic using mocked collaborators and no real database dependency.

2. Unit tests for `PermissionsGuard` using mocked `Reflector` and `PrismaService`.

3. Integration tests using Vitest + Supertest against a real bootstrapped NestJS `AppModule`.

4. The integration suite must exercise the real `auth/*` and `identity/*` HTTP surface against real PostgreSQL and Redis infrastructure.

5. GitHub Actions CI must provision real PostgreSQL and Redis service containers, run the existing Prisma migrations, run the real seed script, and execute the integration suite.

6. The test infrastructure must remain isolated from production behavior. No new production endpoints, Prisma schema changes, frontend work, or unrelated refactoring are allowed.

The local development environment previously had Docker/WSL2 unavailable. WSL2 and Docker are now operational and the repository can run:

- `pgvector/pgvector:pg16`
- `redis:7`

The current local Docker infrastructure exposes PostgreSQL on `localhost:5432` and Redis on `localhost:6379`.

A previous attempt to run the Prisma migration against the local PostgreSQL database failed because the `vector` extension was unavailable. The current Docker PostgreSQL uses the `pgvector/pgvector:pg16` image and should be used for the live integration verification.

A migration failure record for `20260825111416_init` may still exist in the local database. The implementation/verification process must determine whether the current Docker PostgreSQL is using a reused volume and resolve the database state safely. Do not blindly run `prisma migrate resolve` and do not delete arbitrary Docker volumes.

The goal is to finish Story 04 with actual evidence that the integration suite passes against real PostgreSQL + Redis locally or in GitHub Actions.

---

## Acceptance criteria

### Unit tests

- [ ] `IdentityService` has automated unit tests with mocked `PrismaService`, `JwtService`, `ConfigService`, `TenantContext`, and bcrypt behavior.

- [ ] `login` tests cover:

  - successful login
  - unknown email
  - inactive user
  - incorrect password
  - access/refresh token issuance

- [ ] `refresh` tests cover:

  - valid refresh-token rotation
  - old refresh-token revocation
  - replacement token tracking
  - unknown token
  - expired token
  - already revoked token

- [ ] `revoke` tests cover both existing and missing refresh tokens.

- [ ] `createUser` tests cover successful transaction creation and duplicate-email conflict.

- [ ] `listUsers` tests verify active branch scoping through `TenantContext`.

- [ ] `listUsers` fails correctly when no active branch exists.

- [ ] `updateUser` tests cover not-found behavior and partial update behavior.

- [ ] `listRoles` and `listPermissions` tests verify the documented response mapping.

- [ ] `PermissionsGuard` tests cover:

  - no required permissions → allowed
  - missing authenticated user → denied
  - all required permissions granted → allowed
  - missing required permission → `ForbiddenException`

### Integration tests

- [ ] Integration tests use the real `AppModule`.

- [ ] The test application applies the same relevant global configuration as `main.ts`, including validation, API prefix, and cookie parsing.

- [ ] `POST /api/v1/auth/login` succeeds with the seeded admin.

- [ ] Login returns an access token and refresh-token cookie.

- [ ] Invalid admin password returns `401`.

- [ ] `GET /api/v1/auth/me` succeeds with the issued access token.

- [ ] Protected identity routes return `401` without authentication.

- [ ] Seeded SuperAdmin can create a user.

- [ ] An Agent-role user without the required permission receives `403`.

- [ ] Roles and permissions endpoints return the seeded roles and permissions.

- [ ] A newly created user can be deactivated through the update endpoint.

- [ ] A deactivated user cannot log in.

### Database integration

- [ ] PostgreSQL runs from the Story 04-compatible `pgvector/pgvector:pg16` image.

- [ ] Redis runs from the Story 04-compatible `redis:7` image.

- [ ] Prisma migrations apply successfully to the actual test database.

- [ ] The real `prisma/seed.ts` executes successfully.

- [ ] No Prisma schema changes are introduced by this story.

### CI

- [ ] `.github/workflows/ci.yml` provisions PostgreSQL and Redis service containers.

- [ ] PostgreSQL uses `pgvector/pgvector:pg16`.

- [ ] Redis uses `redis:7`.

- [ ] CI uses real database/Redis connection values matching the service containers.

- [ ] CI executes the Prisma migration using a valid package command.

- [ ] CI executes the real seed script.

- [ ] CI runs unit tests.

- [ ] CI runs the integration suite.

- [ ] The Docker image build job remains unchanged unless a genuine Story 04 requirement is discovered.

### Verification

- [ ] API typecheck passes.

- [ ] API lint passes.

- [ ] API build passes.

- [ ] Workspace typecheck passes.

- [ ] Workspace lint passes.

- [ ] Workspace build passes.

- [ ] Existing unit tests pass.

- [ ] Integration tests actually pass against real PostgreSQL + Redis locally or in CI.

- [ ] The final report contains evidence of the successful integration run.

---

## Attachments

| File (relative to this folder) | What it is                     |
| ------------------------------ | ------------------------------ |
| None                           | No binary attachments required |

---

## Dependencies

- **Blocked by / related ids:** None.

- **Depends on code areas or other stories:**

  - Story 02 — monorepo/tooling/auth foundation
  - Story 03 — Identity seed and user-management implementation
  - `apps/api/src/modules/identity/identity.service.ts`
  - `apps/api/src/modules/identity/users.controller.ts`
  - `apps/api/src/modules/identity/identity.controller.ts`
  - `apps/api/src/common/auth/auth.guard.ts`
  - `apps/api/src/common/auth/permissions.guard.ts`
  - `apps/api/src/common/auth/jwt.strategy.ts`
  - `apps/api/src/common/auth/require-permissions.decorator.ts`
  - `apps/api/src/common/auth/public.decorator.ts`
  - `apps/api/prisma/seed.ts`
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/app.module.ts`
  - `apps/api/package.json`
  - `.github/workflows/ci.yml`
  - `docs/architecture/11-quality-and-operations.md`

## Extra notes

- This story is a continuation/final verification of the Identity & Access testing work.

- Existing production behavior from Stories 02–03 must remain unchanged.

- Do not silently add an Agent user to the seed script merely to satisfy integration tests. If the existing seed does not provide an Agent login, create the required Agent test user through the existing API flow without changing seed behavior.

- Do not claim Story 04 fully verified unless real integration tests have actually passed.

- If CI cannot be observed from the implementation environment, explicitly report CI verification as pending.

## Technical hints

- Repository root: `.`

- Primary language: `typescript`

- Backend: NestJS

- ORM: Prisma

- Database: PostgreSQL

- Vector extension: pgvector

- Cache: Redis

- Unit/integration test runner: Vitest

- HTTP integration testing: Supertest

- CI: GitHub Actions

- Local infrastructure: Docker Compose

- Prisma commands should use `pnpm exec prisma ...` when invoking the Prisma CLI directly; do not assume `prisma` is an npm script.

## Out of scope

- No Prisma schema changes.

- No new Prisma models.

- No new production endpoints.

- No changes to existing IdentityService business behavior except a genuine bug discovered during testing, which must be explicitly reported.

- No frontend changes.

- No `apps/web`, `apps/portal`, or `apps/worker` feature work.

- No Playwright browser tests.

- No observability/tracing work.

- No branch/department/role/permission CRUD.

- No WSL2 repair work.

- No Docker Desktop repair work.

- No unrelated refactoring.

- No Story 05 implementation.
