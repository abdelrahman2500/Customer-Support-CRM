# Story intake

- Folder: `.squad/stories/project-foundation/identity-test-suite-and-ci-integration/intake.md`
- Binaries (screenshots, PDFs, exports): none.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit.

---

## Feature

- **Feature name (display):** Project Foundation & System Architecture
- **Feature slug (folder under `plans/`):** `project-foundation`

Continues the `project-foundation` feature (global sequence `NN=04`). Still platform/foundation work, not a CRM feature.

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** _(none — not linked)_

---

## Title

```
Identity & Access — Automated Test Suite and CI-Verified Database Integration
```

---

## Description

Story 02 built the identity/auth/tenant foundation; Story 03 made it usable
(seed data, bootstrap admin, user/role/permission management). Neither has
any automated test coverage — every app's `test` script still reports
"No test files found, exiting with code 0". The only verification either
story received was manual: a no-database boot smoke test confirming routes
register, plus a manual `curl` walkthrough that has never actually been run
end-to-end, because Docker Desktop's engine has been unavailable on the
development machine since Story 02 (broken WSL2 install, `Wsl/CallMsi/
Install/REGDB_E_CLASSNOTREG` — not fixed as of this story).

This means the platform's entire security-critical surface — password
verification, refresh-token rotation and reuse detection, tenant/branch
scoping, and permission enforcement — has never been exercised by anything
other than reading the code. Building a CRM feature (customers, tickets, ...)
on top of that would mean building on an untested authorization layer.

This story adds the first real automated test suite for `apps/api`'s
Identity & Access surface (unit tests for `IdentityService` and
`PermissionsGuard`, integration tests for the `auth/*` and `identity/*`
HTTP routes), and — because local Docker/WSL2 remains broken — extends
`.github/workflows/ci.yml` with real Postgres/Redis **service containers**
so the integration tests, a real `prisma migrate deploy`, and the seed
script are actually verified end-to-end in CI, independent of the local
machine's WSL2 problem. This is a deliberate way to make progress despite
the environment blocker Stories 02 and 03 both had to defer around, rather
than waiting on it.

## Product rules

- **Current:** No test files exist anywhere in the repository. CI generates
  the Prisma client against dummy env vars but never runs a real database.
  Migrations and the seed script have never been executed against a real
  Postgres instance by anyone/anything other than a person's own machine.
- **New:** `apps/api` has unit tests for its identity business logic and
  integration tests for its HTTP surface. CI provisions real Postgres and
  Redis service containers, runs a real migration and the real seed script,
  and runs the full test suite against them on every PR and push to `main`.

---

## Acceptance criteria

```markdown
- [ ] Vitest is configured for `apps/api` such that `pnpm --filter @crm/api test`
      actually runs tests (not `--passWithNoTests` against zero files).
- [ ] Unit tests cover `IdentityService.login` (success; wrong password;
      inactive user; unknown email — all via `PrismaService`/`bcrypt`
      mocks, no real database), `IdentityService.refresh` (valid rotation;
      expired token; revoked/already-rotated token rejected),
      `IdentityService.createUser` (success; duplicate-email conflict),
      `IdentityService.updateUser` (not-found; partial update),
      `IdentityService.listUsers` (branch-scoped via a mocked
      `TenantContext`), and `IdentityService.listRoles`/`listPermissions`.
- [ ] A unit test covers `PermissionsGuard` (no permissions required → allowed;
      required permission granted → allowed; required permission missing →
      `ForbiddenException`).
- [ ] At least one integration test suite (Supertest, against a real
      bootstrapped Nest application) exercises the real HTTP surface end to
      end against a real Postgres/Redis: `POST /api/v1/auth/login` (success
      and failure), `GET /api/v1/auth/me`, a protected `identity/*` route
      called with no token (`401`), called by a caller lacking the required
      permission (`403`), and the full happy path (login as the seeded
      admin → create a user → list users → update a user → list roles →
      list permissions, all succeeding).
- [ ] `.github/workflows/ci.yml` provisions real Postgres and Redis service
      containers, runs `prisma migrate deploy` and the seed script against
      them, and runs the full unit + integration suite in that environment.
- [ ] This is the first time a real migration and the real seed script are
      verified to succeed end-to-end since they were introduced in Stories
      02 and 03 — achieved via CI, not local infrastructure.
- [ ] No new Prisma models or schema changes.
- [ ] No new business/CRM endpoints, and no endpoints introduced beyond what
      testing itself requires (e.g. no new production routes).
- [ ] No frontend changes.
- [ ] Existing lint/typecheck/build behavior, and Story 02/03's existing
      routes and manual boot-smoke-test result, are unaffected — regression
      check.
- [ ] If local Docker/WSL2 is still unavailable when this story is
      implemented, local execution of the integration suite is explicitly
      documented as deferred; the CI service-container run (triggered by
      pushing the branch / opening a PR) is the actual verification of
      record for this story, and its result is reported.
```

---

## Attachments

| File (relative to this folder) | What it is     |
| ------------------------------ | -------------- |
| None                           | No attachments |

---

## Dependencies

- **Blocked by / related ids:** Story 02 (Monorepo & Environment Scaffolding) and Story 03 (Identity & Access: Seed Data, Bootstrap Admin, and User/Role Management) — both completed. This story tests their existing code; it does not add to or redesign it.

- **Depends on code areas or other stories:**
  `apps/api/src/modules/identity/*`, `apps/api/src/common/auth/*`,
  `apps/api/src/prisma/*`, `apps/api/prisma/seed.ts`,
  `.github/workflows/ci.yml` — all read-and-extend, not redesigned.

## Extra notes (optional)

- Do **not** re-implement, rename, or refactor anything Story 03 built
  (seed script, `createUser`/`listUsers`/`updateUser`/`listRoles`/
  `listPermissions`, `UsersController`) — this story tests it as-is. If a
  genuine bug is found while writing a test, fix the minimal bug and note
  it in the report; do not use this story as cover for a broader refactor.
- E2E browser tests (Playwright, per docs/architecture/11-quality-and-operations.md)
  are explicitly out of scope — that document already says E2E coverage
  stays intentionally shallow and is for user-facing flows once there is a
  UI worth testing that way. This story is API-level only.
- If local Docker/WSL2 has been fixed by the time this story is
  implemented, local verification (docker-compose + a real local test run)
  should be done in addition to CI, not instead of it — the CI path is a
  hedge against the environment blocker, not a replacement for local
  verification when it's available.

## Technical hints (optional)

- `@nestjs/testing`, `supertest`, and `@types/supertest` are already
  `apps/api` devDependencies (added in Story 02) — no new test-framework
  dependency should be needed for this story.
- GitHub Actions' built-in `services:` key (Postgres/Redis Docker images
  run by the Actions runner itself) is unaffected by this development
  machine's local WSL2 problem — that's the whole point of routing
  verification through CI for this story.
- `gh` CLI is available in this environment and can push a branch / open a
  PR / poll a workflow run (`gh run list`, `gh run view`) to observe the
  actual CI result as this story's verification evidence.

## Out of scope

- Any customer management, ticketing, communication channel, SLA/automation,
  Knowledge Base, AI, customer portal, reporting, or integration feature.
- Any new Prisma model, schema, or migration beyond what already exists.
- Any new production (non-test) endpoint.
- Frontend/UI test coverage (`apps/web`, `apps/portal`) — a future story's
  concern.
- Playwright/E2E browser tests.
- Observability/tracing (pino structured logging, OpenTelemetry, `/metrics`)
  — still deferred per docs/architecture/11-quality-and-operations.md.
- Branch/department/role/permission CRUD — still deferred per Story 03.
- Fixing the local machine's WSL2/Docker installation — that is an OS-level
  fix for the user to perform; this story works around it via CI, not by
  attempting to repair it.

```

```
