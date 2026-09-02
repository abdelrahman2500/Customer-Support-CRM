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
in that role can see. Explicit audit logging of auth events (login,
failed login, logout, password reset) and role/permission changes (with
before/after diffs), in addition to the general mutation audit interceptor.

### Customer Management — Partially implemented
Branch-scoped customers and contacts, full CRUD except delete. Agents can
set a contact's Customer Portal password. There is no search/filter on the
customer list endpoint yet (a plain unfiltered list).

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
preferences and branch-configurable message templates. There is no
outbound email/SMS/push delivery — this is an in-app/Socket.IO mechanism.

### Agent Workspace — Implemented
The Next.js app agents use day to day: authenticated ticket list/detail
with live updates, ticket/customer creation, a real dashboard (own open
tickets + unassigned/claimable tickets), customer/contact editing, live
in-app toast notifications and a notification history view, user/role/
permission administration, branch/department administration, business
hours and SLA policy administration, automation rule administration,
branch branding configuration, per-branch AI feature-flag configuration,
audit log viewing, live chat with a portal customer, AI ticket-assist
(summarize/suggest-reply/categorize) results on the ticket detail view, and
reporting dashboards.

### Communication / Channels — Foundation only
The data model (`ChannelMessage`) supports five channel types (email,
WhatsApp, SMS, live chat, web form), but only **live chat** has a working
producer today, shared by the Agent Workspace and Customer Portal over the
`ticket:{id}` realtime room. Email/WhatsApp/SMS/web-form ingestion is
schema-only, awaiting a chosen external provider (see Roadmap).

### Attachments — Implemented
S3-compatible object storage (MinIO locally) for both ticket and customer
attachments: upload via multipart form data, download via short-lived
(15-minute) presigned URLs — never a proxied binary or redirect.

### Knowledge Base — Implemented
Branch-scoped articles with draft/published status and immutable version
snapshots taken on each publish. Search is a plain case-insensitive
substring match (not full-text or vector search — see AI section). The
Customer Portal browses published-only, branch-scoped articles.

### AI-assisted Ticket Operations — Implemented
A shared `AiProvider` abstraction (`packages/ai`) with a real Anthropic
implementation and a "disabled" no-op implementation, selected by whether
an API key is configured. Every AI call — ticket summarize/suggest-reply/
categorize, and portal chat — is asynchronous: the API durably logs a
`PENDING` `AiPromptLog` row and enqueues a BullMQ job; `apps/worker` makes
the actual provider call and hands the result back over a second queue; the
API relays completion over Socket.IO to the requesting agent or customer.
Prompts are logged by hash reference, not raw text. Ticket-assist results
are advisory only (never auto-applied to the ticket) and are polled/viewed
on the ticket detail page. Per-branch feature flags let a branch admin
disable any of the four AI operations independently. There is no
retrieval-augmented generation, KB grounding, tool use, or multi-turn
context beyond raw message history — this is a human-in-the-loop assist
layer, not an autonomous agent.

### Customer Portal — Implemented
A separate contact-authenticated Next.js app (its own JWT audience and
refresh cookie, entirely separate from agent auth): submit and track own
tickets (with history and CSAT feedback once resolved/closed), browse the
published Knowledge Base, live chat with an agent, talk to the same AI
chatbot pipeline described above (single-turn Q&A, no KB grounding), and
see the branch's live branding (logo/colors).

### Reporting & Administration — Implemented (foundation-depth)
Five direct-query, branch-scoped reports: ticket volume by status, SLA
compliance rate, average CSAT, agent performance (open/resolved counts),
and ticket aging buckets. All are computed on demand from existing tables
(no reporting schema or materialized views yet), and ticket
resolution-time metrics aren't possible yet because `Ticket` has no
`resolvedAt` column. Administration covers audit log viewing, branch
branding, and per-branch AI feature flags; branch/department management
lives under Identity & Access.

### Integrations — Planned, not implemented
`docs/architecture/09-integrations.md` describes a generic Integration Hub
(inbound webhooks, an outbound sync queue, ERP/email adapter interfaces).
None of this exists in code yet — it's blocked on choosing the external
ERP/channel providers (see Roadmap).

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
not yet used by any column; search today is plain SQL `contains`, not
vector or full-text search) with 37 Prisma models grouped into 9 logical
schemas: `identity`, `admin`, `customers`, `ticketing`, `sla`,
`notifications`, `knowledge_base`, `ai`, `channels`. Cross-module
communication inside `apps/api` goes through typed domain events
(`@nestjs/event-emitter`), not direct cross-module database writes.

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
cp .env.example apps/worker/.env   # worker only reads REDIS_URL/NODE_ENV from it
echo 'NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"' > apps/web/.env.local
echo 'NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"' > apps/portal/.env.local
```

`.env.example`'s `DATABASE_URL` points at port **5432** by default. If
you're using `docker compose`'s Postgres as started above, change the port
in `apps/api/.env` to **5433** to match; if you're pointing at a native
Postgres install on 5432 instead, leave it as-is and skip starting the
`postgres` container.

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

## Environment Variables

Values below are read from `apps/api/.env` and `apps/worker/.env` (see
`.env.example`); `apps/web`/`apps/portal` only need `NEXT_PUBLIC_API_URL`.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime mode (`development`/`production`/`test`). |
| `PORT` | `apps/api` HTTP port (default `3001`). |
| `DATABASE_URL` | PostgreSQL connection string. |
| `REDIS_URL` | Redis connection string (BullMQ queues + Socket.IO adapter). |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_TTL` | Access-token signing secret (min 32 chars) and lifetime (default `15m`). |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_TTL_DAYS` | Refresh-token signing secret and lifetime in days (default `7`). |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | Object storage config for attachments (defaults match the local MinIO container). |
| `CORS_ORIGINS` | Comma-separated allowed browser origins for the REST API and Socket.IO gateway. Unset = no cross-origin access allowed. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Read only by `prisma/seed.ts`, to create the initial SuperAdmin. |
| `ANTHROPIC_API_KEY` (optional) | Enables the real Anthropic AI provider (`apps/worker`). Absent = AI features fall back to a no-op "disabled" provider that still logs the request but never calls out. Not present in `.env.example` — add it yourself to enable AI. |
| `ANTHROPIC_MODEL` (optional) | Model id for the Anthropic provider; defaults to `claude-sonnet-4-5-20250929`. |
| `NEXT_PUBLIC_API_URL` | Base API URL used by both `apps/web` and `apps/portal` (`http://localhost:3001/api/v1` locally). |

## Application URLs

| Service | URL |
|---|---|
| Agent Workspace (`apps/web`) | http://localhost:3000 |
| Customer Portal (`apps/portal`) | http://localhost:3002 |
| API (`apps/api`) | http://localhost:3001 (routes under `/api/v1`) |
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

`apps/api/test/` currently holds 33 e2e spec files covering identity/RBAC,
customers, tickets, SLA/business-hours/escalations, automation rules,
attachments, knowledge base, notifications (preferences/templates/read),
audit logs, branding, realtime foundations, AI settings/processing, and the
full Customer Portal surface (auth, tickets, KB, chat, branding).

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
  pipeline above. It has no Knowledge Base grounding/retrieval, no tool
  use, and no multi-turn context beyond the raw message history sent to
  the model — a deliberate, disclosed scope limit, not a bug.
- **Per-branch feature flags**: a branch admin can independently disable
  summarize/suggest-reply/categorize/chat; a disabled call still logs a
  `DISABLED`-outcome row (for traceability) but never reaches the queue or
  the provider.

## Project Status

The platform has grown well past ticketing basics into a broad,
cross-domain product surface. At a high level:

**Fully implemented:** Identity & Access (RBAC, audit logging), Ticket
Management, SLA & Automation, Realtime (Socket.IO, presence, live chat),
Notifications (in-app), Attachments, Knowledge Base, AI-assisted ticket
operations and portal chat, Customer Portal, Agent Workspace, Reporting
(foundation-depth), and Administration (audit logs, branding, AI feature
flags).

**Partial / foundation-depth:** Customer Management (no search/delete
yet), Communication/Channels (live chat only — email/WhatsApp/SMS/web-form
are schema-only), Reporting (direct-query only, no resolution-time metrics
since `Ticket` has no `resolvedAt`).

**Not implemented:** a generic Integration Hub / ERP adapters.

For the detailed, story-by-story implementation history, see
`.squad/plans/00-index.md` and the individual plans/reports under
`.squad/plans/` and `.squad/stories/`.

## Roadmap / Remaining Work

- **Integration Hub** (`docs/architecture/09-integrations.md`): inbound
  webhooks, outbound sync queue, and ERP/email adapter interfaces —
  explicitly blocked pending a chosen external ERP/channel provider.
- **Additional communication channels**: email, WhatsApp, SMS, and web-form
  ingestion into the existing `ChannelMessage` model — same external
  provider dependency as above.
- **Customer search/filtering** and customer delete.
- **Ticket resolution-time reporting**, which needs a `resolvedAt` column
  first.
- **Production hosting decision** — the platform is cloud-agnostic through
  containers today, but no hosting target has been chosen
  (`docs/architecture/12-risks-tradeoffs-and-scope.md`).
- **AI grounding**: Knowledge Base retrieval/RAG for both ticket-assist and
  the portal chatbot are explicitly out of scope for the current
  implementation.

## Documentation

- [`docs/architecture/README.md`](./docs/architecture/README.md) — start
  here for the full target architecture (technology stack, system
  overview, domain boundaries, data/multitenancy, auth/security,
  communication/realtime, SLA/automation/AI, supporting domains,
  integrations, i18n/RTL, quality/operations, risks/scope).
- [`.squad/plans/`](./.squad/plans/) — per-feature implementation plans.
- [`.squad/stories/`](./.squad/stories/) — per-story intake documents.
- `CLAUDE.md` (repository root) — the autonomous development-loop
  convention this repository's ongoing work follows.

## Contributing

This repository's history is a linear sequence of direct commits to `main`
(no PR/merge-commit flow), one commit per completed Story, following the
plan-then-implement workflow recorded under `.squad/` and `CLAUDE.md`.
Before proposing a change: read `docs/architecture/03-domain-boundaries.md`
for module boundaries, and run the commands in **Development Commands**
and **Testing & Verification** above before committing.

## License

No `LICENSE` file is currently present in this repository.
