# Story 02 — Monorepo & Environment Scaffolding

## Prerequisites

- [Story 01 completed](./01-story-tech-stack-and-architecture-docs.md): `docs/architecture/*` exists and its decisions are the source of truth for every choice made in this story. Do not re-decide the stack here — implement what Story 01 recorded.

---

## Story Goal

Stand up the actual repository skeleton that implements the decisions in `docs/architecture/`: a pnpm/Turborepo monorepo with four apps (`web`, `portal`, `api`, `worker`) and two shared packages, wired together enough to build, lint, and run — with only the minimal `identity` database tables needed to prove the multi-branch/department model. No feature (ticketing, customers, SLA, KB, AI, channels) is implemented. When this story is done, a future feature story can add a module to `apps/api` and a route to `apps/web`/`apps/portal` without first inventing project structure, tooling config, or the base auth/tenant plumbing.

---

## Context — Read These Files First

1. [docs/architecture/01-technology-stack.md](../../../docs/architecture/01-technology-stack.md) — exact package choices and the `apps/*` / `packages/*` shape.
2. [docs/architecture/02-system-architecture-overview.md](../../../docs/architecture/02-system-architecture-overview.md) — module-per-domain layering inside `apps/api`.
3. [docs/architecture/04-data-and-multitenancy.md](../../../docs/architecture/04-data-and-multitenancy.md) — logical-schema-per-domain Prisma setup and the `TenantContext` mechanism this story seeds.
4. [docs/architecture/05-auth-and-security.md](../../../docs/architecture/05-auth-and-security.md) — JWT + RBAC shape the auth scaffolding must follow.
5. [docs/architecture/11-quality-and-operations.md](../../../docs/architecture/11-quality-and-operations.md) — CI steps, health checks, environment config approach.
6. `.gitignore` (repo root) — check what's already excluded before adding `node_modules`, `.env`, `dist`, etc.

---

## Repository layout to create

```
Customer Support CRM/
├── apps/
│   ├── web/          Next.js — agent + admin app
│   ├── portal/       Next.js — customer portal
│   ├── api/           NestJS — HTTP API
│   └── worker/        NestJS standalone — BullMQ workers
├── packages/
│   ├── shared/        shared TS types/DTOs/constants
│   └── config/        shared tsconfig/eslint/prettier
├── docs/
│   └── architecture/  (created in Story 01)
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── tsconfig.base.json
└── .github/workflows/ci.yml
```

---

## Implementation Tasks

### 1 — Root workspace tooling

Create file `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create file `package.json` (root):

```json
{
  "name": "customer-support-crm",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0"
  }
}
```

Create file `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

Create file `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false
  }
}
```

Create `packages/config/package.json`, `packages/config/eslint-preset.js`, and `packages/config/prettier-preset.js` as thin shared configs (base ESLint recommended + TypeScript plugin rules, Prettier defaults with `"printWidth": 100`). Each `apps/*` package extends these rather than redefining lint/format rules locally.

### 2 — Shared types package

Create `packages/shared/package.json` (name `@crm/shared`, `main`/`types` pointing at `src/index.ts`, built with `tsup` or plain `tsc`).

Create `packages/shared/src/index.ts` exporting, at minimum, the shapes the auth/tenant scaffolding in `apps/api` and the frontend both need:

```typescript
export interface JwtAccessTokenClaims {
  sub: string; // user id
  audience: "agent" | "customer";
  branchId: string | null;
  departmentId: string | null;
  roles: string[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  branchId: string | null;
  departmentId: string | null;
  roles: string[];
}
```

Both `apps/api` and `apps/web`/`apps/portal` depend on `@crm/shared` via the pnpm workspace protocol (`"@crm/shared": "workspace:*"`).

### 3 — `apps/api` (NestJS)

Scaffold with the Nest CLI conventions (you do not need the CLI installed — hand-write the standard structure):

```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── tenant/
│   │   │   ├── tenant-context.ts
│   │   │   └── tenant.middleware.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── auth.guard.ts
│   │   │   └── permissions.guard.ts
│   │   └── audit/
│   │       └── audit.interceptor.ts
│   ├── health/
│   │   └── health.controller.ts
│   └── modules/
│       └── identity/
│           ├── identity.module.ts
│           ├── identity.controller.ts
│           └── identity.service.ts
├── prisma/
│   └── schema.prisma
├── package.json
├── tsconfig.json
└── Dockerfile
```

**`prisma/schema.prisma`** — minimal foundation only (identity schema, per [Data & Multi-Tenancy](../../../docs/architecture/04-data-and-multitenancy.md)). Do **not** add ticketing/customers/etc. tables in this story:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema", "postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector"), pg_trgm]
  schemas    = ["identity", "admin"]
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  branches  Branch[]

  @@schema("identity")
}

model Branch {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String
  timezone       String
  departments    Department[]
  users          UserBranchRole[]
  createdAt      DateTime     @default(now())

  @@schema("identity")
}

model Department {
  id        String   @id @default(uuid())
  branchId  String
  branch    Branch   @relation(fields: [branchId], references: [id])
  name      String
  createdAt DateTime @default(now())

  @@schema("identity")
}

model User {
  id           String            @id @default(uuid())
  email        String            @unique
  passwordHash String
  fullName     String
  isActive     Boolean           @default(true)
  branchRoles  UserBranchRole[]
  createdAt    DateTime          @default(now())

  @@schema("identity")
}

model Role {
  id          String           @id @default(uuid())
  name        String           @unique
  permissions RolePermission[]

  @@schema("identity")
}

model Permission {
  id    String           @id @default(uuid())
  key   String           @unique // e.g. "ticket:reassign"
  roles RolePermission[]

  @@schema("identity")
}

model RolePermission {
  roleId       String
  role         Role       @relation(fields: [roleId], references: [id])
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
  @@schema("identity")
}

// A user can hold a role scoped to a branch (and optionally a department within it).
model UserBranchRole {
  id           String      @id @default(uuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id])
  branchId     String
  branch       Branch      @relation(fields: [branchId], references: [id])
  departmentId String?
  roleId       String
  role         Role        @relation(fields: [roleId], references: [id])

  @@unique([userId, branchId, departmentId, roleId])
  @@schema("identity")
}

// Append-only audit log — no update/delete grants for the app's runtime DB role.
model AuditLog {
  id         String   @id @default(uuid())
  actorId    String?
  action     String
  entityType String
  entityId   String?
  branchId   String?
  diff       Json?
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@schema("admin")
}
```

`Role` and `RolePermission` also need the `role` back-relation on `Role` — add `permissions RolePermission[]` (already shown) and, symmetrically, ensure `RolePermission.role`/`.permission` relations compile (`prisma validate` catches any mismatch — fix names to match exactly before moving on).

**`src/common/tenant/tenant-context.ts`** — request-scoped provider populated by `tenant.middleware.ts` from the validated JWT claims (`branchId`, `departmentId`). Every future module's repository/service layer reads the active branch/department from this provider instead of trusting a client-supplied branch id — implement it now as an empty-but-wired `@Injectable({ scope: Scope.REQUEST })` class with `branchId: string | null` and `departmentId: string | null` fields, so Story 03+ (ticketing, customers, …) has it ready to inject.

**`src/common/auth/`** — Passport JWT strategy validating the access token against `@crm/shared`'s `JwtAccessTokenClaims` shape, an `AuthGuard` applied globally via `APP_GUARD`, and a `PermissionsGuard` reading a `@RequirePermissions(...)` decorator (stub the decorator + guard now; there are no real permission-gated endpoints yet beyond identity's own).

**`src/modules/identity/`** — expose exactly two endpoints for this story: `POST /api/v1/auth/login` (email + password → access + refresh token) and `GET /api/v1/auth/me` (returns the authenticated user + their branch/department/role assignments). This is enough to prove the auth pipeline end-to-end without building user management CRUD (that's a future admin story).

**`src/health/health.controller.ts`** — `GET /health` (liveness, always 200) and `GET /health/ready` (checks a `SELECT 1` against Postgres and a `PING` against Redis).

**`Dockerfile`** — standard multi-stage Node 20 build (`pnpm install --frozen-lockfile` → `pnpm --filter api build` → slim runtime image running `node dist/main.js`).

### 4 — `apps/worker` (NestJS standalone)

```
apps/worker/
├── src/
│   ├── main.ts              # NestFactory.createApplicationContext, no HTTP listener
│   ├── worker.module.ts
│   └── queues/
│       └── health.processor.ts   # trivial BullMQ processor proving the Redis connection
├── package.json
├── tsconfig.json
└── Dockerfile
```

`health.processor.ts` registers a `health-check` queue processor that just logs and resolves — this exists only to prove `apps/worker` connects to Redis/BullMQ correctly; the real queues (`sla-timers`, `notifications`, `integration-sync`, `ai-processing`, `reports-refresh` — see [Communication & Real-Time](../../../docs/architecture/06-communication-and-realtime.md)) are added by the feature stories that need them.

### 5 — `apps/web` (Next.js — agent app)

- `create-next-app`-equivalent structure with App Router, TypeScript, Tailwind CSS.
- `next-intl` configured with `messages/en.json` and `messages/ar.json` (a handful of placeholder keys — `common.appName`, `common.loading` — is enough for this story), `[locale]` route segment, root layout setting `dir` from the active locale per [i18n & RTL](../../../docs/architecture/10-i18n-and-rtl.md).
- One placeholder route: `/[locale]/(agent)/dashboard/page.tsx` rendering a static "Signed in as {user.email}" page that calls `GET /api/v1/auth/me` server-side, proving the frontend-to-`apps/api` auth wiring works end to end (login form can be minimal/unstyled — this is a wiring proof, not a finished screen).
- Tailwind config uses logical-property-friendly defaults (no custom left/right utilities added).

### 6 — `apps/portal` (Next.js — customer portal)

- Same base setup as `apps/web` (Next.js App Router, TypeScript, Tailwind, `next-intl`), but its own `package.json`/app — do not share a Next.js app instance between agent and portal per [System Architecture Overview](../../../docs/architecture/02-system-architecture-overview.md).
- One placeholder route proving it's a distinct app: `/[locale]/page.tsx` with a static "Customer Portal" placeholder page. No real portal auth/ticket flow yet.

### 7 — Local infrastructure

Create file `docker-compose.yml` at the repo root with services: `postgres` (image `pgvector/pgvector:pg16`, since `pgvector` must be available — see [Technology Stack](../../../docs/architecture/01-technology-stack.md)), `redis` (image `redis:7`), `minio` (S3-compatible object storage), `mailhog` (local email catcher for outbound email testing later). Expose standard ports (5432, 6379, 9000/9001, 1025/8025) and use named volumes for Postgres/MinIO data.

Create file `.env.example` at the repo root listing every environment variable the apps read (`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET`, `NEXT_PUBLIC_API_URL`) with placeholder/local-dev values — never real secrets.

### 8 — CI

Create file `.github/workflows/ci.yml`: on `pull_request` and `push` to the default branch — checkout, setup Node 20 + pnpm, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`. No deploy job (production deployment is out of scope for this feature — see [Risks](../../../docs/architecture/12-risks-tradeoffs-and-scope.md)).

### 9 — Root README

Update or create the repository root `README.md` with: what the project is (one paragraph, pointing at `docs/architecture/README.md` for the full architecture), and a "Getting started" section: `pnpm install` → `docker compose up -d` → `pnpm --filter api prisma migrate dev` → `pnpm dev`.

---

## Verification Steps

1. **Install:** `pnpm install` completes with no errors from the repo root.
2. **Infra up:** `docker compose up -d postgres redis minio mailhog` — all four containers report healthy.
3. **Migrate:** `pnpm --filter api prisma migrate dev --name init` creates the `identity` and `admin` schemas with the tables from the Prisma schema above, with no errors.
4. **Backend builds and boots:** `pnpm --filter api build` succeeds; `pnpm --filter api start:prod` (or `dev`) boots and `GET /health` returns 200 and `GET /health/ready` returns 200 once Postgres/Redis are up.
5. **Worker boots:** `pnpm --filter worker dev` starts without error and the `health-check` queue processor logs a successful Redis connection.
6. **Frontend runs:** `pnpm --filter web dev` serves `/en/dashboard` and `/ar/dashboard`, and the `ar` route renders with `dir="rtl"` on the root element (inspect the rendered HTML).
7. **Portal runs:** `pnpm --filter portal dev` serves its placeholder route on both locales.
8. **Lint/typecheck:** `pnpm lint` and `pnpm typecheck` pass across all `apps/*` and `packages/*`.
9. **CI:** the `.github/workflows/ci.yml` steps succeed when run locally in the same order (or once pushed, in Actions).
10. **Regression:** re-open the `docs/architecture/` documents from Story 01 and confirm nothing built here contradicts a recorded decision (module names, schema names, queue names all match).

## Done Criteria

- [ ] Monorepo builds via `pnpm build` (Turborepo) across all four apps and two packages.
- [ ] `apps/api` exposes `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `GET /health`, `GET /health/ready`, backed by the minimal `identity`/`admin` Prisma schema above.
- [ ] `apps/worker` boots standalone and proves its Redis/BullMQ connection via the `health-check` queue.
- [ ] `apps/web` and `apps/portal` each serve a placeholder route in both `en` and `ar`, with RTL confirmed for `ar`.
- [ ] `docker-compose.yml` brings up Postgres (with `pgvector`), Redis, MinIO, and MailHog for local development.
- [ ] CI (`.github/workflows/ci.yml`) runs install/lint/typecheck/build/test on every PR.
- [ ] No ticketing/customer/SLA/KB/AI/channel/reporting/admin feature tables or endpoints were added — only the identity/auth/tenant foundation.
