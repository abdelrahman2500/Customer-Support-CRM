# Customer Support CRM

A full-stack, multi-branch customer support platform: ticketing with SLA
targets and automation, a Knowledge Base, an AI-assisted agent workspace, a
customer self-service portal with live chat and an AI chatbot, reporting,
and administration — built as a TypeScript monorepo (NestJS + Next.js +
Prisma/PostgreSQL) with Arabic/English i18n and RTL support throughout.

See **[docs/architecture/README.md](./docs/architecture/README.md)** for the
full target architecture — domain boundaries, data model, auth/security,
realtime, SLA/automation/AI design, i18n, and known risks/scope decisions
are all recorded there. This README covers what the repository actually
contains today: how to run it, and what's implemented versus still planned.

## Overview

The platform has four runtime surfaces plus two shared packages:

- **`apps/api`** — the NestJS HTTP API (REST, prefixed `/api/v1`) and the
  authenticated Socket.IO realtime gateway. The source of truth for every
  domain: identity, customers, ticketing, SLA/automation, notifications,
  knowledge base, AI, attachments, portal access, reporting, and admin.
- **`apps/web`** — the **Agent Workspace** (Next.js): the internal
  application agents and branch admins use to work tickets, manage
  customers/users/roles, configure SLA/automation/branding/AI settings, and
  view reports.
- **`apps/portal`** — the **Customer Portal** (Next.js): a separate,
  contact-authenticated app for customers to submit/track their own
  tickets, browse the published Knowledge Base, live-chat with an agent,
  and talk to an AI chatbot.
- **`apps/worker`** — a standalone NestJS process that runs the BullMQ
  background jobs the API enqueues: SLA timer detection/breach handling and
  AI provider calls (ticket-assist and portal chat), handing results back to
  the API over a second queue for realtime delivery.
- **`packages/ai`** — a framework-neutral `AiProvider` boundary (Anthropic
  implementation + a no-op "disabled" implementation) shared by `apps/api`
  and `apps/worker`.
- **`packages/shared`** / **`packages/config`** — shared TypeScript
  types/DTOs, and shared tsconfig/ESLint/Prettier presets, respectively.

## Current capabilities

Evidence-based status as of the current repository state (branch `main`).
"Implemented" means the feature has working backend endpoints/data model and
a consuming frontend where one is relevant; "Foundation" means the
plumbing/data model is real but only a narrow slice is wired up; "Planned"
means only architecture documentation exists.

### Identity & Access — Implemented
Branches, departments, users, roles/permissions (RBAC via a `Role` ↔
`Permission` catalog of ~38 permission keys), and a `UserBranchRole` join
that scopes a user to a branch/department/role. JWT access tokens plus
rotating, hashed refresh tokens (cookie-based). A role's
`ticketVisibilityScope` (`BRANCH` or `DEPARTMENT`) restricts what an agent
in that role can see. Per-account login lockout after 5 failed attempts
(15-minute lock, Story 122), enforced password complexity on account
creation/reset (Story 123), and self-service session/device management —
list and revoke active sessions (Story 124). Explicit audit logging of
auth events (login, failed login, account lockout, logout, password
reset) and role/permission changes (with before/after diffs), in addition
to the general mutation audit interceptor.

### Customer Management — Partially implemented
Branch-scoped customers and contacts, full CRUD except delete. Agents can
set a contact's Customer Portal password. The customer list endpoint
supports search (Story 101), an `isActive` filter, sorting by display
name or creation date, and standard pagination. Delete is still not
implemented.

### Ticket Management — Implemented
Tickets with status/priority/category, department/assignee, append-only
history and internal notes, list filtering (status/priority/category/
assignee/search) and sorting. Every cross-reference (customer, contact,
department, assignee) is re-validated against the caller's branch on write.

### SLA & Automation — Implemented
SLA policies (branch/department/category/priority-scoped targets),
business-hours calendars with exceptions, business-hours-aware target
computation, breach/at-risk detection via `apps/worker`, and breach
escalation. Automation rules match on ticket category and can assign an
owner, set the category, and/or set the department on ticket creation
(each action only applies when the field is still unset, never overriding a
human choice); a category/department change re-triggers SLA target
recomputation.

### Realtime & Notifications — Implemented
An authenticated Socket.IO gateway (Redis-backed adapter) with
room-scoped, audience-aware authorization: `ticket:{id}` (shared by the
assigned agent and the ticket's customer, with internal-only events
filtered from the customer), `branch:{id}:notifications` (agent-only
branch-wide SLA/escalation broadcasts), `chat-session:{id}` (customer-only
portal chat), and `agent:{id}:presence` (Redis-backed agent
online/offline). In-app notifications are logged (`NotificationLog`),
readable via a history endpoint, and gated by per-user, per-event-type
preferences and branch-configurable message templates. SLA-at-risk/breach
and ticket-escalation notifications (RM-26), and Customer Portal
notifications (RM-19), are also delivered by real outbound email via
`apps/worker`'s `EmailAdapter` (skipped gracefully when no `SMTP_HOST` is
configured), gated by the same in-app preference toggle — there is
currently no independent email-only opt-out, and no SMS/push delivery.

### Agent Workspace — Implemented
The Next.js app agents use day to day: authenticated ticket list/detail
with live updates, ticket/customer creation, a real dashboard (own open
tickets + unassigned/claimable tickets, plus a personal task/reminder
panel), customer/contact editing, live in-app toast notifications and a
notification history view, user/role/permission administration,
branch/department administration, business hours and SLA policy
administration, automation rule administration, branch branding
configuration, per-branch AI feature-flag configuration, audit log
viewing (with search), live chat with a portal customer, AI ticket-assist
results on the ticket detail view, and reporting dashboards (with CSV
export and saved dashboards).

### Communication / Channels — Partially implemented
The data model (`ChannelMessage`) supports five channel types (email,
WhatsApp, SMS, live chat, web form). Three now have a real, working
adapter/producer: **live chat** (shared by the Agent Workspace and
Customer Portal over the `ticket:{id}` realtime room), **email** —
outbound only, a real SMTP send via `apps/worker`'s `EmailAdapter` (RM-15,
used both for an agent's "send as email" reply and for the automated
notification emails described above); inbound email parsing is still a
stub, deferred — and **web form** (RM-14/Story 87 — a public,
unauthenticated ticket-intake endpoint that finds-or-creates a contact and
files a ticket directly; no external provider needed). **WhatsApp and SMS
remain schema-only**, awaiting a chosen external provider (see Roadmap).
Outbound webhooks (notifying an org's own external systems of CRM events)
are a separate, implemented capability — see Integrations below.

### Attachments — Implemented
S3-compatible object storage (MinIO locally) for both ticket and customer
attachments: upload via multipart form data, download via short-lived
(15-minute) presigned URLs — never a proxied binary or redirect.

### Knowledge Base — Implemented
Branch-scoped articles with draft/published status and immutable version
snapshots taken on each publish. Search is real PostgreSQL full-text
search (Story 102) — a generated `tsvector` column, `websearch_to_tsquery`
matching, `ts_rank`-ordered results — not a substring match, and not
vector/embedding search (see AI section: the `pgvector` extension is
declared in the schema but unused by any column). Articles support an
optional per-locale (English/Arabic) title/body translation layered on
top of the article's own default-locale content, never replacing it
(Story 109/`kb-multi-locale`). The Customer Portal browses
published-only, branch-scoped articles.

### AI-assisted Ticket Operations — Implemented
A shared `AiProvider` abstraction (`packages/ai`) with a real Anthropic
implementation and a "disabled" no-op implementation, selected by whether
an API key is configured. Every AI call — ticket summarize/suggest-reply/
categorize/suggest-solutions, and portal chat — is asynchronous: the API
durably logs a `PENDING` `AiPromptLog` row and enqueues a BullMQ job;
`apps/worker` makes the actual provider call and hands the result back
over a second queue; the API relays completion over Socket.IO to the
requesting agent or customer. Prompts are logged by hash reference, not
raw text. Ticket-assist results are advisory only (never auto-applied to
the ticket) and are polled/viewed on the ticket detail page. Per-branch
feature flags let a branch admin disable any of the five AI operations
independently. Portal chat and Suggested Solutions are grounded in the
Knowledge Base: the worker retrieves up to three published, branch-scoped
articles via the same PostgreSQL `tsvector` full-text search the KB itself
uses and passes them to the provider as context (Story 117/`f4af9dc` for
the portal chatbot, RM-00/`50bdf22` for ticket-assist). That retrieval is
lexical — no embeddings and no `pgvector` similarity search, both deferred
pending an external embeddings-provider decision (Anthropic exposes no
embeddings endpoint). There is no tool use, and agent-facing output stays
advisory — this is a human-in-the-loop assist layer, not an autonomous
agent.

### Customer Portal — Implemented
A separate contact-authenticated Next.js app (its own JWT audience and
refresh cookie, entirely separate from agent auth): submit and track own
tickets (with history, attachments, and CSAT feedback once
resolved/closed), browse the published Knowledge Base, live chat with an
agent, talk to the same AI chatbot pipeline described above (grounded in
the published Knowledge Base via `tsvector` full-text search, not
embeddings), see in-app and emailed notifications (one combined
preference toggle — no independent email opt-out yet), and see the
branch's live branding (logo/colors).

### Reporting & Administration — Implemented (foundation-depth)
Eight direct-query, branch-scoped reports: ticket volume by status,
ticket volume by category, SLA compliance rate, average CSAT, agent
performance (open/resolved counts), ticket aging buckets, ticket
resolution time (using `Ticket.resolvedAt`, set when a ticket is
resolved/closed — Story 99), and AI usage/cost (Story 121). Every report
has a CSV export (Story 125), and agents can save a named set of report
widgets as a dashboard (`reporting-saved-dashboards`). All are computed on
demand from existing tables — no reporting schema or materialized views
yet. Administration covers audit log viewing (with search), branch
branding, per-branch AI feature flags, and agent task/reminder tracking;
branch/department management lives under Identity & Access.

### Integrations — Partially implemented
`docs/architecture/09-integrations.md` describes a generic Integration
Hub. Three pieces of it are real, working code today: **API keys**
(RM-22 — HMAC-hashed, scoped, tenant-bound; the guard itself is
implemented and unit-tested, but no production endpoint currently accepts
one — only an internal test fixture exercises it), **outbound webhook
subscriptions** (RM-20 — an org registers a target URL + event types, CRM
domain events are dispatched to it, with delivery-attempt logging), and an
**inbound webhook receiver** (RM-21 — raw-body signature verification;
every payload is logged whether verified or not) — this last one is a
verification/logging framework only: it ships with zero registered
provider verifiers, and even a verified payload is not yet translated
into a ticket/`ChannelMessage` (explicitly deferred to whichever future
provider-specific story registers a real verifier). **ERP adapters are
not implemented** — blocked on choosing an external ERP/protocol (see
Roadmap).

## Architecture

```text
apps/
  web/      Next.js — Agent Workspace (agents, admins, reporting)
  portal/   Next.js — Customer Portal (contact-authenticated)
  api/      NestJS — REST API (/api/v1) + Socket.IO realtime gateway
  worker/   NestJS standalone — BullMQ background jobs (SLA timers, AI calls)

packages/
  shared/   Shared TypeScript types/DTOs (auth, JWT) used by API and both frontends
  config/   Shared tsconfig / ESLint / Prettier presets
  ai/       Framework-neutral AiProvider boundary (Anthropic + disabled implementations)

docs/
  architecture/  Target-architecture source of truth — read this first
.squad/
  plans/, stories/  Per-story implementation plans, intakes, and history
```

The database is a single PostgreSQL instance (the `pgvector/pgvector:pg16`
image — the `pgvector`/`pg_trgm` extensions are declared in the schema but
not yet used by any column; Knowledge Base search uses native PostgreSQL
full-text search, `tsvector`/`ts_rank`, not the `pgvector` extension, so
there is no vector/embedding-based search anywhere yet) with 52 Prisma
models grouped into 12 logical schemas: `identity`, `admin`, `customers`,
`ticketing`, `sla`, `notifications`, `knowledge_base`, `ai`, `channels`,
`tasks`, `integrations`, `reporting`. Cross-module communication inside
`apps/api` goes through typed domain events (`@nestjs/event-emitter`), not
direct cross-module database writes.

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript ^5.9.3, Node.js ≥20, pnpm 10.34.5 (workspaces + Turborepo ^2.10.11) |
| Backend API | NestJS ^11.2, Prisma 6.19.3, class-validator, Zod (env validation), Passport JWT |
| Database | PostgreSQL 16 (`pgvector/pgvector:pg16` image; `pgvector`/`pg_trgm` extensions declared, not yet used) |
| Jobs / Queue | BullMQ ^6.2 on Redis 7 (`@nestjs/bullmq`, `ioredis`) |
| Realtime | Socket.IO ^4.8 (`@nestjs/websockets`, `@nestjs/platform-socket.io`, `@socket.io/redis-adapter`) |
| Object storage | S3-compatible via `@aws-sdk/client-s3` (MinIO locally) |
| AI | `@anthropic-ai/sdk` ^0.122 behind a shared `AiProvider` interface (`packages/ai`), with a disabled no-op fallback |
| Frontend (both apps) | Next.js ^15.5 (App Router), React ^18.3, TanStack Query ^5.10, Zustand ^5.0, `next-intl` ^4.13 (Arabic/English, RTL), `socket.io-client` ^4.8 |
| Frontend (Agent Workspace) | Tailwind CSS ^3.4, Radix UI primitives, `class-variance-authority`, `lucide-react` |
| Testing | Vitest ^4.1 (unit + component, every package), Supertest ^7.2 (API e2e) |
| Local infra | Docker Compose — Postgres, Redis, MinIO, MailHog |
| API docs | Swagger/OpenAPI, generated in non-production environments |

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm 10 (`corepack enable`, or `npm install -g pnpm@10.34.5`)
- Docker Desktop (for Postgres/Redis/MinIO/MailHog), or your own local
  Postgres 16 + Redis if you'd rather not use Docker.

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local infrastructure

```bash
docker compose up -d
# Only Postgres and Redis are required for the app itself:
#   docker compose up -d postgres redis
```

`docker-compose.yml` maps the `postgres` service to **host port 5433**
(`5433:5432`) rather than the default 5432, specifically to avoid
conflicting with a natively-installed PostgreSQL that may already own 5432
on your machine. Redis is on its default `6379`; MinIO on `9000`
(API)/`9001` (console); MailHog on `1025` (SMTP)/`8025` (web UI).

### 3. Configure environment variables

```bash
cp .env.example apps/api/.env
cp .env.example apps/worker/.env   # worker reads DATABASE_URL/APP_DATABASE_URL/REDIS_URL/
                                    # NODE_ENV/SENTRY_DSN plus its own ANTHROPIC_*/SMTP_* —
                                    # see apps/worker/src/env.validation.ts
echo 'NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"' > apps/web/.env.local
echo 'NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"' > apps/portal/.env.local
```

`.env.example`'s `DATABASE_URL` already points at port **5433**, matching
`docker compose`'s Postgres started above. If you're pointing at a native
Postgres install on 5432 instead, change the port in `apps/api/.env` (and
`apps/worker/.env`) to **5432** and skip starting the `postgres` container.

### 4. Apply the database schema and seed data

```bash
pnpm --filter @crm/api exec prisma migrate deploy
pnpm --filter @crm/api prisma:seed
```

The seed script creates an initial organization/branch and a SuperAdmin
user from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.

### 5. Run everything

```bash
pnpm dev
```

`apps/api` creates its S3 bucket (`S3_BUCKET`, `crm-attachments` by
default) automatically on startup if it doesn't already exist
(`S3StorageService.onModuleInit`) — no separate MinIO console step is
needed for a fresh local MinIO container.

Confirm the stack is actually up with `curl http://localhost:3001/health/ready`
— `{"status":"ok",...}` means the API can reach both Postgres and Redis; a
503 names which one it can't (see **Application URLs** below for both
health routes).

## Environment Variables

Values below are read from `apps/api/.env` and `apps/worker/.env` (see
`.env.example`); `apps/web`/`apps/portal` only need `NEXT_PUBLIC_API_URL`.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime mode (`development`/`production`/`test`). |
| `PORT` | `apps/api` HTTP port (default `3001`). |
| `DATABASE_URL` | PostgreSQL connection string — the migration/owner role (`prisma migrate deploy`/`prisma db seed`/`prisma generate`). |
| `APP_DATABASE_URL` (optional) | The restricted runtime `crm_app` role `apps/api`/`apps/worker` actually connect as when set (denied schema changes and `admin.audit_logs` UPDATE/DELETE); falls back to `DATABASE_URL` when unset. |
| `REDIS_URL` | Redis connection string (BullMQ queues + Socket.IO adapter). |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_TTL` | Access-token signing secret (min 32 chars) and lifetime (default `15m`). |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_TTL_DAYS` | Refresh-token signing secret and lifetime in days (default `7`). Must differ from `JWT_ACCESS_SECRET`. |
| `API_KEY_HASH_SECRET` (optional) | HMAC key `apps/api` hashes agent API keys with; falls back to `JWT_REFRESH_SECRET` when unset. |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | Object storage config for attachments (defaults match the local MinIO container; all four required explicitly in production). |
| `CORS_ORIGINS` | Comma-separated allowed browser origins for the REST API and Socket.IO gateway. Unset = no cross-origin access allowed. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Read only by `prisma/seed.ts`, to create the initial SuperAdmin. |
| `ANTHROPIC_API_KEY` (optional) | Enables the real Anthropic AI provider (`apps/worker`). Absent = AI features fall back to a no-op "disabled" provider that still logs the request but never calls out. Not present in `.env.example` — add it yourself to enable AI. |
| `ANTHROPIC_MODEL` (optional) | Model id for the Anthropic provider; defaults to `claude-sonnet-4-5-20250929`. |
| `SMTP_HOST` / `SMTP_FROM` (optional) | Read by both apps: `apps/worker`'s `EmailAdapter` is the actual SMTP transport (local dev points these at the Mailhog sandbox on `localhost:1025`); `apps/api` only uses their presence to answer `GET /channels/email-status`, so the chat composer's "send by email" option isn't offered when no adapter is configured. With no `SMTP_HOST`, no `EMAIL` channel adapter registers at all — not an error. |
| `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` (optional, `apps/worker` only) | The rest of `EmailAdapter`'s SMTP transport config; `SMTP_PORT` defaults to `587`. |
| `SENTRY_DSN` (optional) | Read by `apps/api` and `apps/worker`. Unhandled exceptions are always caught and logged locally either way; a set DSN additionally reports them to Sentry or a Sentry-protocol-compatible self-hosted GlitchTip. |
| `AUTH_COOKIE_SAMESITE` (optional) | `SameSite` for the httpOnly refresh-token cookie: `strict` (default), `lax`, or `none`. Only needs changing when the deployed frontends and the API sit on different registrable domains — see [`docs/deployment.md`](./docs/deployment.md). |
| `NEXT_PUBLIC_API_URL` | Base API URL used by both `apps/web` and `apps/portal` (`http://localhost:3001/api/v1` locally). **Compiled into the browser bundle at build time** — for a container image it must be passed as a `--build-arg`, not a runtime variable. |
| `NEXT_PUBLIC_SENTRY_DSN` (optional) | Same DSN as `SENTRY_DSN`, read by `apps/web`/`apps/portal`. Must be `NEXT_PUBLIC_`-prefixed and set at *build* time (only `NEXT_PUBLIC_*` vars are inlined into the browser bundle) — each app's server/edge runtime still reads the plain `SENTRY_DSN` above. |

> **Deploying?** `CORS_ORIGINS` is required in production, the two JWT
> secrets must differ, and `NEXT_PUBLIC_API_URL` must be set when the
> frontend images are *built*. All three are enforced now (startup
> validation for the first two; a build-time guard plus
> `scripts/assert-public-api-url.mjs` for the third). See
> [`docs/deployment.md`](./docs/deployment.md) and
> [`.env.production.example`](./.env.production.example).

## Application URLs

| Service | URL |
|---|---|
| Agent Workspace (`apps/web`) | http://localhost:3000 |
| Customer Portal (`apps/portal`) | http://localhost:3002 |
| API (`apps/api`) | http://localhost:3001 (routes under `/api/v1`) |
| API liveness / readiness | http://localhost:3001/health / http://localhost:3001/health/ready (unversioned — not under `/api/v1`; readiness checks Postgres and Redis, 503 if either is unreachable) |
| Swagger/OpenAPI docs | http://localhost:3001/api/docs (non-production only) |
| `apps/worker` | no HTTP port — background process, logs to console |
| PostgreSQL (Docker) | localhost:5433 (see port note above) |
| Redis (Docker) | localhost:6379 |
| MinIO API / Console (Docker) | localhost:9000 / localhost:9001 |
| MailHog Web UI (Docker) | localhost:8025 |

## Development Commands

```bash
pnpm dev         # turbo run dev — all apps
pnpm build       # turbo run build — all apps/packages
pnpm lint        # turbo run lint
pnpm typecheck   # turbo run typecheck
pnpm test        # turbo run test — unit/component tests only, every package except @crm/e2e
pnpm format      # prettier --write .
```

Run any script for a single package with `pnpm --filter <name> <script>`
(`@crm/api`, `@crm/web`, `@crm/portal`, `@crm/worker`, `@crm/shared`,
`@crm/ai`, `@crm/config`). Prisma-specific scripts live under
`@crm/api`: `prisma:generate`, `prisma:validate`, `prisma:migrate`,
`prisma:seed`.

## Testing & Verification

```bash
pnpm --filter @crm/api test        # unit tests (Vitest)
pnpm --filter @crm/api test:e2e    # e2e tests (Supertest) — resets & re-seeds the DB, needs real Postgres + Redis running
pnpm --filter @crm/web test        # unit/component tests (Vitest + Testing Library)
pnpm --filter @crm/portal test     # unit/component tests (Vitest + Testing Library)
pnpm --filter @crm/worker test     # unit tests (Vitest)
pnpm --filter @crm/worker test:e2e # worker e2e (SLA timer processor)
pnpm --filter @crm/e2e test        # browser E2E (Playwright) — boots pre-built apps/api +
                                    # apps/web + apps/portal; needs real Postgres/Redis running
                                    # and all three already built (`pnpm exec turbo run build
                                    # --filter=<pkg>` for each — a bare `pnpm --filter <pkg>
                                    # build` skips @crm/shared/@crm/ai's own build). Deliberately
                                    # excluded from root `pnpm test` (turbo run test): it needs
                                    # prerequisites (built apps, installed browsers) that the
                                    # generic unit-test sweep does not provide — see the
                                    # dedicated `browser-e2e` CI job.
```

`apps/api/test/` currently holds 54 e2e spec files covering identity/RBAC,
customers, tickets, SLA/business-hours/escalations, automation rules,
attachments, knowledge base (including category taxonomy and article
attachments), notifications (preferences/templates/read), audit logs,
branding, realtime foundations, AI settings/processing, tasks, webhook
subscriptions/inbound logs, API keys, and the full Customer Portal surface
(auth, tickets, KB, chat, branding). This count drifts as new stories land —
`find apps/api/test -iname "*.e2e-spec.ts" | wc -l` is the source of truth,
not this sentence.

CI (`.github/workflows/ci.yml`) runs on every PR and push to `main`:
install → Prisma generate → lint → typecheck → build → unit tests
(`pnpm test`) → API e2e tests against real Postgres/Redis/MinIO service
containers. A separate `browser-e2e` job then builds `apps/api`/`apps/web`/
`apps/portal`, installs Chromium, and runs `pnpm --filter @crm/e2e test`
(pre-built apps only — `apps/api` boots via `node dist/main.js`, not `nest
start --watch`, since the live compile measured close enough to Playwright's
webServer timeout to genuinely time out on a real CI run) against real
Postgres/Redis service containers with CI-provided env values. Another
separate job builds (but does not push or deploy) a Docker image per app on
pushes to `main`.

Run `pnpm test`/`test:e2e` yourself to establish current pass/fail status —
this README does not assert a specific pass count. One disclosed,
pre-existing, environment-specific test-isolation issue is documented in
`CLAUDE.md` (`identity.e2e-spec.ts`, accumulating extra SuperAdmin/role
rows across repeated runs against the same dev database); it is unrelated
to any single feature and is resolved by a clean `prisma migrate reset` or
re-seed.

## Realtime

`apps/api/src/realtime/` runs a single authenticated Socket.IO gateway
(Redis-backed adapter for horizontal scaling), sharing the same JWT as the
REST API for both agent and customer (portal) audiences. Rooms are joined
explicitly by the client and authorized server-side per audience:

- **`ticket:{id}`** — an agent (branch match) or the ticket's own customer
  (their `customerId` match) joins this. `ticket.updated` and
  `channel.message.created` (live chat) are shared by both audiences;
  `ticket.escalated`, `ticket.note-added`, and `ai.prompt_completed` are
  relayed to agents in the room only — never to the customer sharing it.
- **`branch:{id}:notifications`** — every agent's workspace joins this once
  per session and receives branch-wide `sla.at_risk`, `sla.breached`, and
  `ticket.escalated` broadcasts as transient toast notifications.
- **`chat-session:{id}`** — a portal customer's own AI chat session;
  receives `ai.chat_message_completed` when the assistant's reply is ready.
- **`agent:{id}:presence`** — Redis-backed online/offline presence for an
  agent or their same-branch colleagues, with graceful cleanup on
  disconnect.

Live chat between an agent and a customer is implemented today over the
shared `ticket:{id}` room — this is a real, working feature, not a
placeholder.

## AI

AI is implemented as an asynchronous, provider-abstracted assist layer, not
a synchronous in-request call or an autonomous agent:

- **Provider boundary** (`packages/ai`): an `AiProvider` interface
  (`summarize`, `suggestReply`, `categorize`, `chat`) with a real Anthropic
  implementation (`@anthropic-ai/sdk`) and a `NullAiProvider` fallback used
  automatically when no API key is configured. Shared, unmodified, by both
  `apps/api` and `apps/worker`.
- **Async pipeline**: `apps/api` never calls the AI provider directly — it
  creates a durable `AiPromptLog` row (`PENDING`, or `DISABLED` if the
  feature is off) and enqueues a BullMQ job (`ai-processing`). `apps/worker`
  performs the actual call, updates that same log row (model, token
  counts, latency, outcome, output/error), and enqueues a second job
  (`ai-processing-events`) that `apps/api` consumes to emit a completion
  event. Prompts are referenced by hash, not stored as raw text.
  Ticket-assist results are always advisory — never auto-applied to the
  ticket.
- **Realtime delivery**: completion is relayed over Socket.IO —
  `ai.prompt_completed` to the requesting agent's `ticket:{id}` room, or
  `ai.chat_message_completed` to the customer's `chat-session:{id}` room —
  and also retrievable by polling a `GET .../ai/:logId` endpoint.
- **Ticket-assist** (Agent Workspace): summarize, suggest-reply, and
  categorize actions on a ticket's detail page, each an independent,
  human-reviewed suggestion.
- **Portal AI chatbot**: a real, working single-turn Q&A chatbot for
  authenticated Customer Portal users, built on the identical async
  pipeline above. It is grounded in the published Knowledge Base through
  `tsvector` full-text search (Story 117, `f4af9dc`) — but that retrieval
  is lexical, not embeddings/`pgvector` similarity. It has no tool use,
  and no multi-turn context beyond the raw message history sent to the
  model — deliberate, disclosed scope limits, not bugs.
- **Per-branch feature flags**: a branch admin can independently disable
  summarize/suggest-reply/categorize/chat; a disabled call still logs a
  `DISABLED`-outcome row (for traceability) but never reaches the queue or
  the provider.

## Project Status

The platform has grown well past ticketing basics into a broad,
cross-domain product surface. At a high level:

**Fully implemented:** Identity & Access (RBAC, audit logging, account
lockout, password complexity, session management), Ticket Management, SLA
& Automation, Realtime (Socket.IO, presence, live chat), Notifications
(in-app + email), Attachments, Knowledge Base (full-text search,
multi-locale), Tasks & Reminders, AI-assisted ticket operations and
portal chat, Customer Portal, Agent Workspace, Reporting (8 reports, CSV
export, saved dashboards — still direct-query, no reporting schema or
materialized views), and Administration (audit logs, branding, AI feature
flags).

**Partial / foundation-depth:** Customer Management (search/filter/sort
implemented; delete still missing), Communication/Channels (live
chat/email/web-form implemented; WhatsApp/SMS still schema-only),
Integrations (API keys and outbound webhooks implemented and tested;
inbound webhooks are a verification/logging framework only — no
registered provider, no translation into domain events yet; no
production endpoint currently accepts an API key).

**Not implemented:** ERP adapters; WhatsApp/SMS channel adapters.

For the detailed, story-by-story implementation history, see
`.squad/plans/00-index.md` and the individual plans/reports under
`.squad/plans/` and `.squad/stories/`.

## Roadmap / Remaining Work

- **Integration Hub completion** (`docs/architecture/09-integrations.md`):
  registering a real inbound-webhook provider verifier and translating a
  verified payload into a ticket/`ChannelMessage`; ERP adapters — both
  explicitly blocked pending a chosen external ERP/channel provider. The
  API-key guard is now wired to a real endpoint (Story 133):
  `GET /api/v1/integrations/reports/ticket-volume`, read-only JSON, scoped
  by `integration:read` and confined to the key's own branch. Widening that
  machine surface to further report families or the CSV exports is a
  separate, deliberate decision.
- **WhatsApp and SMS channel adapters** into the existing `ChannelMessage`
  model/`ChannelAdapterRegistry` — same external provider dependency as
  above; inbound email parsing is also still a stub.
- **Customer hard delete.** Customer **anonymization** is implemented
  instead (Story 132): `POST /customers/:id/anonymize`, behind its own
  `customer:anonymize` permission, clears the customer's and every
  contact's name/email/phone/portal access in one transaction and
  deactivates them. Hard deletion is deliberately not offered — the
  database forbids it (`tickets.customer_id` is `RESTRICT NOT NULL`) and
  six related relations are `CASCADE`, so ticket/SLA/reporting history is
  preserved rather than destroyed. Free-text message bodies, customer
  notes, survey comments, uploaded files and the immutable audit log are
  retained by design, not erased.
- **Production hosting decision** — the platform is cloud-agnostic through
  containers today, but no hosting target has been chosen
  (`docs/architecture/12-risks-tradeoffs-and-scope.md`).
- **Vector-based AI grounding**: Knowledge Base grounding itself is
  implemented for both the portal chatbot (Story 117, `f4af9dc`) and
  ticket-assist Suggested Solutions (RM-00, `50bdf22`), using PostgreSQL
  `tsvector` full-text search. Replacing that lexical retrieval with
  embeddings/`pgvector` semantic retrieval is what remains deferred — it
  requires an external embeddings-provider decision, and Anthropic exposes
  no embeddings endpoint (`.squad/plans/ai-chat-kb-grounding/`).

## Documentation

- [`docs/architecture/README.md`](./docs/architecture/README.md) — start
  here for the full target architecture (technology stack, system
  overview, domain boundaries, data/multitenancy, auth/security,
  communication/realtime, SLA/automation/AI, supporting domains,
  integrations, i18n/RTL, quality/operations, risks/scope).
- [`docs/deployment.md`](./docs/deployment.md) — how to deploy so a real
  browser reaches the deployed API and stays signed in: the build-time vs
  runtime configuration split, CORS and cookie `SameSite`, the
  migration/runtime database contract, and exactly which values the
  deployment platform must supply.
- [`.squad/plans/`](./.squad/plans/) — per-feature implementation plans.
- [`.squad/stories/`](./.squad/stories/) — per-story intake documents.
- `CLAUDE.md` (repository root) — the autonomous development-loop
  convention this repository's ongoing work follows.
- [`docs/ASSESSMENT-EVIDENCE.md`](./docs/ASSESSMENT-EVIDENCE.md) — the
  AI/SDD workflow used, verification strategy and actual test/lint/build
  evidence (explicitly distinguishing verified-this-session from
  previously-verified from blocked/deferred), ownership/decision-making
  evidence, architectural trade-offs, and a factual productivity
  narrative.

## Contributing

This repository's history is a linear sequence of direct commits to `main`
(no PR/merge-commit flow), one commit per completed Story, following the
plan-then-implement workflow recorded under `.squad/` and `CLAUDE.md`.
Before proposing a change: read `docs/architecture/03-domain-boundaries.md`
for module boundaries, and run the commands in **Development Commands**
and **Testing & Verification** above before committing.

## License

No `LICENSE` file is currently present in this repository.
