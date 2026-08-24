# Customer Support CRM

A full-stack Customer Support CRM platform: multi-branch/multi-department
ticketing, multi-channel communication (email, WhatsApp, SMS, live chat, web
forms), SLA/automation, a Knowledge Base, AI-assisted agent tooling, a
customer self-service portal, reporting, and administration — in Arabic and
English with full RTL support.

**This repository currently contains only the project foundation** (Story
02 of the `project-foundation` feature): a monorepo skeleton, identity/auth/
tenant infrastructure, and local dev tooling. No CRM feature (customers,
tickets, SLA, KB, AI, channels, reporting, admin) is implemented yet.

See **[docs/architecture/README.md](./docs/architecture/README.md)** for the
full architecture — every technology choice, domain boundary, and
cross-cutting concern is decided and documented there. Read it before
proposing a design for any new feature.

## Repository layout

```
apps/
  web/      Next.js — agent + admin + management frontend
  portal/   Next.js — customer-facing portal
  api/      NestJS — HTTP API (REST + WebSocket gateways)
  worker/   NestJS standalone — BullMQ background job worker
packages/
  shared/   Shared TypeScript types/DTOs used by the API and both frontends
  config/   Shared tsconfig / ESLint / Prettier configuration
docs/
  architecture/  The source of truth — read this first
```

## Getting started

Prerequisites: Node.js 20+, pnpm 10 (`npm install -g pnpm@10.34.5` or
`corepack enable`), and Docker Desktop.

```bash
# 1. Install dependencies
pnpm install

# 2. Start local infrastructure (Postgres + pgvector, Redis, MinIO, MailHog)
docker compose up -d

# 3. Copy environment templates and adjust if needed (defaults match docker-compose.yml)
cp .env.example apps/api/.env
cp .env.example apps/worker/.env   # only REDIS_URL/NODE_ENV are read
echo 'NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"' > apps/web/.env.local
echo 'NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"' > apps/portal/.env.local

# 4. Apply the database schema (identity/admin — the foundation only, see
#    docs/architecture/04-data-and-multitenancy.md)
pnpm --filter @crm/api prisma:migrate

# 5. Run everything
pnpm dev
```

This starts:

| App | URL |
|---|---|
| `apps/web` (agent app) | http://localhost:3000 |
| `apps/portal` (customer portal) | http://localhost:3002 |
| `apps/api` (HTTP API + Swagger docs) | http://localhost:3001/api/docs |
| `apps/worker` | no HTTP port — logs to the console |

## Common commands

```bash
pnpm build       # turbo run build — all apps/packages
pnpm lint        # turbo run lint
pnpm typecheck   # turbo run typecheck
pnpm test        # turbo run test
pnpm format      # prettier --write .
```

Run any of the above for a single package with `pnpm --filter @crm/api <script>`.

## Status

- ✅ Story 01 — Technology Stack Selection & Architecture Documentation
- ✅ Story 02 — Monorepo & Environment Scaffolding (this state)
- ⏭ Future stories (customer management, ticketing, channels, SLA/automation,
  Knowledge Base, AI, customer portal, reporting, administration,
  integrations) — see `.squad/plans/` for planned work.
