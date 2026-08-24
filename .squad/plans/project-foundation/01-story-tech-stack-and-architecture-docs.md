# Story 01 — Technology Stack Selection & Architecture Documentation

## Prerequisites

None. This is the first story in the `project-foundation` feature and the first story in the repository.

---

## Story Goal

Produce a complete, decided (not open-ended) architecture for the Customer Support CRM platform, written down as a set of Markdown documents under `docs/architecture/`. Every acceptance criterion in the intake is a documentation deliverable in this story — **no application code, database schema, or infrastructure is created here** (that starts in [Story 02](./02-story-monorepo-scaffolding.md)).

The documents produced here are the single source of truth that all future feature stories (tickets, customers, SLA, KB, AI, portal, reporting, admin, integrations) must read before proposing a design. They must be concrete enough that nobody re-litigates "what framework/DB/auth approach do we use" again.

---

## Context — Read These Files First

1. `.squad/stories/project-foundation/project-foundation/intake.md` — the full product scope, acceptance criteria, and constraints (TypeScript required, no frontend/backend framework selected yet, avoid premature infrastructure, single-company multi-branch/multi-department, Arabic+English+RTL, AI features, many channels).
2. `.squad/plans/project-foundation/00-overview.md` — sequencing of this feature's stories.
3. `.gitignore` (repo root) — see what tooling is already anticipated (Node/TS project artifacts) so the docs stay consistent with it.
4. There is no existing application code in this repository yet — do not search for prior architecture to reconcile with; this story establishes it from scratch.

---

## Decisions to record (binding for all later stories)

These are the concrete decisions the docs below must contain. Do not re-open them without an explicit ADR-style justification written into the relevant doc.

| Concern | Decision |
|---|---|
| Language | TypeScript everywhere (frontend, backend, worker, shared packages) |
| Monorepo tooling | pnpm workspaces + Turborepo |
| Frontend | Next.js 14+ (App Router), React 18, Tailwind CSS, shadcn/ui (Radix), TanStack Query, Zustand, next-intl |
| Backend/API | NestJS (Node 20 LTS), modular monolith, REST + OpenAPI (Swagger), class-validator DTOs |
| Database | PostgreSQL 16, Prisma ORM, `pgvector` extension for embeddings |
| Cache / queue / pub-sub | Redis 7 (BullMQ for jobs, Socket.IO Redis adapter, caching) |
| Object storage | S3-compatible (MinIO locally; AWS S3 / Azure Blob in production) |
| Real-time | Socket.IO gateway in NestJS, Redis adapter for horizontal scaling |
| Auth | Self-hosted JWT (short-lived access + rotating refresh), Passport strategies, RBAC + CASL for fine-grained checks |
| AI | Provider-agnostic `AiProvider` interface, initially backed by the Anthropic Claude API |
| Background jobs | BullMQ workers in a dedicated `apps/worker` process |
| CI | GitHub Actions (matches the linked tracker) |
| Deployment | Containers (Docker), cloud-agnostic; specific hosting platform deferred (see risks doc) |

---

## Implementation Tasks

Create the following files exactly as specified. Each is a complete document — write the content between the `markdown` fence into the target file (adjust only if it contradicts something you can verify is already decided elsewhere in this plan; do not silently change decisions).

### 1 — Create `docs/architecture/README.md`

Create file: `docs/architecture/README.md`

```markdown
# Customer Support CRM — Architecture

This folder is the single source of truth for the platform's technical foundation. Every story that touches the backend, frontend, database, or infrastructure must read the relevant document(s) below before proposing a design. Decisions recorded here are binding; changing one requires updating the doc and calling out the change explicitly in the story that needs the change.

## Documents

1. [Technology Stack](./01-technology-stack.md) — the chosen stack and why.
2. [System Architecture Overview](./02-system-architecture-overview.md) — frontend, backend, and their boundary.
3. [Domain Boundaries](./03-domain-boundaries.md) — the bounded contexts / modules of the system.
4. [Data & Multi-Tenancy](./04-data-and-multitenancy.md) — database strategy, branch/department scoping.
5. [Auth & Security](./05-auth-and-security.md) — authentication, authorization, audit logging, security boundaries.
6. [Communication & Real-Time](./06-communication-and-realtime.md) — channels, WebSockets, background jobs, notifications.
7. [SLA, Automation & AI](./07-sla-automation-and-ai.md) — SLA/automation and AI integration, high level.
8. [Supporting Domains](./08-supporting-domains.md) — Knowledge Base, Customer Portal, Reporting — high level.
9. [Integrations](./09-integrations.md) — external systems (ERP, email/SMS/WhatsApp providers, public API).
10. [Internationalization & RTL](./10-i18n-and-rtl.md) — Arabic/English and RTL strategy.
11. [Quality & Operations](./11-quality-and-operations.md) — testing, observability, deployment/environments.
12. [Risks, Trade-offs & Scope](./12-risks-tradeoffs-and-scope.md) — known risks, trade-offs, and explicit non-goals.

## Status

Foundation established by Story 01 (this feature's plan: `.squad/plans/project-foundation/`). No feature code exists yet — see [Story 02](../../.squad/plans/project-foundation/02-story-monorepo-scaffolding.md) for the initial repository scaffolding that implements these decisions.
```

### 2 — Create `docs/architecture/01-technology-stack.md`

```markdown
# Technology Stack

## Decision

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict mode) everywhere | One language across frontend/backend/worker/shared code lowers context-switching cost and lets DTOs/types be shared via a workspace package. Matches the project's declared primary language. |
| Monorepo tooling | pnpm workspaces + Turborepo | Fast installs, strict dependency isolation (no phantom deps), Turborepo caches builds/tests across `apps/*` and `packages/*` as the number of domains grows. |
| Frontend framework | Next.js 14+ (App Router), React 18 | Server components reduce client bundle size for a content-heavy CRM (tables, dashboards), built-in routing/layouts fit multi-section apps (agent app, admin, portal), large ecosystem, first-class TypeScript. |
| UI layer | Tailwind CSS + shadcn/ui (Radix primitives) | Accessible, unstyled primitives copied into the repo (no opaque component-library lock-in), Tailwind's logical properties make RTL support tractable (see [i18n & RTL](./10-i18n-and-rtl.md)). |
| Client data/state | TanStack Query (server state) + Zustand (light local UI state) | Avoids a heavy global store; most CRM state is server state (tickets, customers) best modeled as cached queries with invalidation, not a Redux store. |
| i18n | next-intl | App Router-native, supports per-locale routing and RTL direction switching. |
| Backend framework | NestJS (Node 20 LTS) | Opinionated module system maps directly onto the bounded contexts in [Domain Boundaries](./03-domain-boundaries.md), first-class DI (testability), built-in Guards/Interceptors (authz, audit logging), native WebSocket gateways and BullMQ integration, OpenAPI generation via decorators. |
| API style | REST, versioned (`/api/v1/...`), OpenAPI/Swagger generated from code | REST is sufficient for the CRUD- and workflow-heavy surface described in the intake; GraphQL is not adopted now (see [Risks](./12-risks-tradeoffs-and-scope.md) for the trade-off). |
| Database | PostgreSQL 16 | Relational integrity for tickets/customers/SLA data, JSONB for flexible/variable fields (channel metadata, AI output), mature, widely hostable, supports the `pgvector` extension for future embeddings-based search without adding a separate database technology. |
| ORM | Prisma | TypeScript-first schema and generated client, good migration story, works with logical Postgres schemas (see [Data & Multi-Tenancy](./04-data-and-multitenancy.md)). |
| Cache / queue / pub-sub | Redis 7 | Backs BullMQ (background jobs), the Socket.IO Redis adapter (horizontal scaling of real-time), and general caching. One piece of infrastructure serving three needs. |
| Background jobs | BullMQ, run inside a dedicated `apps/worker` Node process | Keeps long-running/scheduled work (SLA timers, notification delivery, integration sync, AI calls) off the request path of the API process. |
| Real-time | Socket.IO server (NestJS gateway) + Socket.IO client, Redis adapter | Handles live chat, ticket live-updates, and in-app notifications with automatic fallback transports and room support (per-ticket, per-branch rooms). |
| Object storage | S3-compatible (MinIO for local/dev, AWS S3 or Azure Blob in production) | Ticket/customer attachments must not live on local disk or in the database; S3 API is the de facto standard and keeps the hosting provider undecided until deployment time. |
| Auth | Self-hosted JWT (Passport strategies in NestJS): short-lived access token + rotating refresh token in an httpOnly cookie | Full control over the multi-branch/department claim model and audit requirements (see [Auth & Security](./05-auth-and-security.md)) without an external vendor dependency for a B2B-internal tool; SSO (OIDC/SAML) is left as a pluggable future strategy, not built now. |
| AI | Anthropic Claude API via `@anthropic-ai/sdk`, wrapped behind an internal `AiProvider` interface | See [SLA, Automation & AI](./07-sla-automation-and-ai.md). The interface exists so the provider can change without touching call sites. |
| Testing | Vitest (unit, frontend + backend), Supertest (API integration), Playwright (E2E) | Modern, fast, TypeScript-native; see [Quality & Operations](./11-quality-and-operations.md). |
| CI | GitHub Actions | The project's tracker/repo host is GitHub; no reason to introduce a second CI system. |
| Containers | Docker, `docker-compose` for local dev | Cloud-agnostic; production hosting platform is an explicit open decision (see [Risks](./12-risks-tradeoffs-and-scope.md)), not blocked by this choice. |

## Repository shape (implemented in Story 02)

- `apps/web` — agent + admin + management frontend (Next.js).
- `apps/portal` — customer-facing portal (Next.js), separate app sharing UI/shared packages, because its auth model and audience differ from the agent app.
- `apps/api` — NestJS HTTP API (REST + WebSocket gateways).
- `apps/worker` — NestJS standalone worker process consuming BullMQ queues.
- `packages/shared` — shared TypeScript types/DTOs/constants used by both frontend apps and the API.
- `packages/config` — shared `tsconfig`, ESLint, Prettier configuration.

## Explicitly deferred technology decisions

- Specific production hosting platform (Kubernetes vs. managed container service vs. PaaS).
- Search engine upgrade path beyond Postgres full-text (`tsvector`) — e.g., Meilisearch/Elasticsearch — only if KB/ticket search volume justifies it.
- Analytics warehouse (e.g., ClickHouse) for reporting — only if reporting query load outgrows Postgres.
- GraphQL — only if a concrete consumer (e.g., a future mobile app) needs it.

These are **not** decisions this story is avoiding out of uncertainty — they are decisions this story is explicitly postponing until there is a measured need, per the intake's instruction to avoid premature infrastructure.
```

### 3 — Create `docs/architecture/02-system-architecture-overview.md`

```markdown
# System Architecture Overview

## High-level component map

- **apps/web** (Next.js) — agent workspace, team collaboration, admin/configuration screens, management dashboards. Talks only to `apps/api` over REST (`/api/v1/*`) and WebSocket (`/ws/*`).
- **apps/portal** (Next.js) — customer-facing app (submit/track tickets, KB, feedback). Talks only to `apps/api` over a customer-scoped surface (`/api/v1/portal/*`).
- **apps/api** (NestJS) — the only writer of business data. Exposes REST controllers per domain module (see [Domain Boundaries](./03-domain-boundaries.md)), WebSocket gateways for real-time, and enqueues jobs onto Redis/BullMQ for the worker to process. Owns all authentication/authorization decisions.
- **apps/worker** (NestJS, no HTTP) — consumes BullMQ queues: SLA timers, notification delivery, integration sync, AI processing, scheduled report refresh. Shares domain/service code with `apps/api` via internal packages so business logic is not duplicated.
- **PostgreSQL** — system of record. Accessed only from `apps/api` and `apps/worker` (never directly from a frontend).
- **Redis** — queues (BullMQ), Socket.IO adapter, cache.
- **Object storage (S3-compatible)** — attachments; frontends upload via short-lived pre-signed URLs issued by `apps/api`, never directly to the DB or through the API as a binary blob.
- **Integration Hub** (a module inside `apps/api` initially, see [Integrations](./09-integrations.md)) — adapters for email/SMS/WhatsApp/ERP/web forms; normalizes inbound events into internal domain events, and turns outbound domain events into provider calls (via worker jobs).

## Boundary rules

1. Frontends (`apps/web`, `apps/portal`) never talk to the database, Redis, or third-party channel providers directly. All access goes through `apps/api`.
2. `apps/api` never blocks a request on slow external work (sending an email/WhatsApp message, calling the AI provider, syncing to the ERP). That work is always enqueued to BullMQ and performed by `apps/worker`.
3. Cross-domain communication inside `apps/api` (e.g., "ticket created" needs to notify SLA, Notifications, and AI modules) happens through in-process domain events (NestJS `EventEmitter2`), not by one module importing and calling another module's internals directly. This keeps module coupling low without paying for a message broker yet.
4. Any module that outgrows the in-process model (needs independent scaling, independent deploys, or a different language/runtime) is extracted into its own service communicating over Redis Streams or a proper broker — the domain-event boundary from rule 3 is what makes that extraction possible later without a rewrite. [Integrations](./09-integrations.md) and the AI Gateway are the two most likely candidates; this is called out again in [Risks](./12-risks-tradeoffs-and-scope.md).

## Frontend architecture (`apps/web`, `apps/portal`)

- **Routing**: Next.js App Router, route groups per top-level section (`(agent)`, `(admin)`, `(auth)` in `apps/web`; `(portal)` in `apps/portal`), locale-prefixed routes (`/en/...`, `/ar/...`) via `next-intl`.
- **Data fetching**: Server Components fetch initial data server-side (calling `apps/api` with the request's forwarded auth cookie); client-side interactivity (live updates, mutations, optimistic UI) uses TanStack Query.
- **State**: Server state lives in TanStack Query's cache. Local-only UI state (open panels, selected filters not worth URL-encoding) uses small Zustand stores scoped to a feature, not one global store.
- **Real-time**: a single Socket.IO client connection per app, established after auth, subscribed to rooms relevant to the current view (`ticket:{id}`, `branch:{id}:notifications`); incoming events invalidate/patch the relevant TanStack Query cache entries rather than maintaining a parallel state model.
- **Styling/components**: Tailwind CSS with logical properties, shadcn/ui components copied into `packages/shared` (or a dedicated `packages/ui`) so both `apps/web` and `apps/portal` render consistent, brandable components (see custom branding in [Supporting Domains](./08-supporting-domains.md)).

## Backend/API architecture (`apps/api`)

- **Module-per-domain**: one NestJS module per bounded context in [Domain Boundaries](./03-domain-boundaries.md) (`IdentityModule`, `CustomersModule`, `TicketingModule`, `ChannelsModule`, `SlaModule`, `KnowledgeBaseModule`, `AiModule`, `NotificationsModule`, `ReportingModule`, `PortalModule`, `AdminModule`, `IntegrationsModule`). Each module owns its controllers, services, and Prisma models.
- **Layering inside a module**: `*.controller.ts` (HTTP/DTO boundary, validation via `class-validator`) → `*.service.ts` (business logic) → Prisma client (persistence). Controllers never call Prisma directly.
- **Cross-cutting concerns as global providers**: authentication guard, authorization (permissions) guard, `TenantContext` (branch/department scoping, see [Data & Multi-Tenancy](./04-data-and-multitenancy.md)), audit-logging interceptor, request-id/logging interceptor — registered once, applied everywhere, not re-implemented per module.
- **API versioning**: all routes under `/api/v1`; breaking changes get a new version prefix rather than mutating v1 contracts once a frontend or external integration depends on them.
- **OpenAPI**: generated from Nest decorators (`@nestjs/swagger`), published at `/api/docs` in non-production environments; this is also the contract external integrations (see [Integrations](./09-integrations.md)) are written against.
```

### 4 — Create `docs/architecture/03-domain-boundaries.md`

```markdown
# Domain Boundaries

Each bounded context below becomes one NestJS module (in `apps/api`) and, where noted, one Postgres **logical schema** (Postgres `CREATE SCHEMA`, not a separate database — see [Data & Multi-Tenancy](./04-data-and-multitenancy.md)). Modules communicate through domain events or explicit service interfaces exported from the module — never by reaching into another module's Prisma models directly.

| Domain / Module | Postgres schema | Owns | Notes |
|---|---|---|---|
| Identity & Access | `identity` | Branches, departments, users, roles, permissions, sessions | Also owns `TenantContext` resolution used by every other module. |
| Customer Management | `customers` | Customer profiles, contacts, interaction history, attachments (metadata; binary in object storage) | |
| Ticketing | `ticketing` | Tickets, categories, priorities, statuses, assignments, ticket history/timeline | The core entity most other domains react to via domain events (`ticket.created`, `ticket.updated`, `ticket.escalated`, ...). |
| Communication / Channels | `channels` | Channel configuration, inbound/outbound messages, threads, quick replies | Receives normalized events from the Integration Hub; see [Communication & Real-Time](./06-communication-and-realtime.md). |
| SLA & Automation | `sla` | SLA policies, timers, escalation rules, automation rules | Subscribes to ticketing events; high-level design in [SLA, Automation & AI](./07-sla-automation-and-ai.md). |
| Knowledge Base | `knowledge_base` | Articles, categories, FAQs, publish state, search index | See [Supporting Domains](./08-supporting-domains.md). |
| AI Services | `ai` | AI Gateway config, prompt/response logs, chatbot sessions | Provider-agnostic; see [SLA, Automation & AI](./07-sla-automation-and-ai.md). |
| Notifications | `notifications` | Templates, delivery logs, per-user preferences | See [Communication & Real-Time](./06-communication-and-realtime.md). |
| Reporting & Analytics | `reporting` | Materialized views / read models over other schemas, saved dashboard configs | Read-mostly; never the source of truth for any entity. |
| Customer Portal | (no own schema) | A scoped API surface (`PortalModule`) over Ticketing/KB/Notifications for authenticated customers | Presentation/access-boundary domain, not a data owner. |
| Administration | `admin` | System configuration, branding settings, audit logs | Audit log table is append-only; see [Auth & Security](./05-auth-and-security.md). |
| Integrations | `integrations` | External system connection configs, webhook receipt logs, sync job state | Adapters for ERP/email/SMS/WhatsApp; see [Integrations](./09-integrations.md). |

## Rules

1. A module may read another module's data only through that module's exported service methods or through a `reporting`-schema read model — never by importing another module's Prisma model directly.
2. Side effects that other domains care about are published as domain events (e.g., `TicketingModule` emits `ticket.created`; `SlaModule`, `NotificationsModule`, and `AiModule` subscribe — none of them are called synchronously by `TicketingModule`).
3. New feature stories add a module (or extend an existing one) — they do not introduce a new cross-module dependency without updating this table.
```

### 5 — Create `docs/architecture/04-data-and-multitenancy.md`

```markdown
# Data Strategy & Multi-Branch/Department Architecture

## Database strategy

- **Single PostgreSQL 16 database**, one Prisma schema file (`apps/api/prisma/schema.prisma`) organized with one Postgres **logical schema per domain module** (see [Domain Boundaries](./03-domain-boundaries.md)) via Prisma's `@@schema(...)` multi-schema support. This gives each domain a clearly namespaced set of tables (`identity.users`, `ticketing.tickets`, ...) inside one database — cheap to operate now, and a real boundary to split into separate databases/services later if a domain needs to scale independently.
- **Migrations** are managed by Prisma Migrate, one migration history for the whole database. Each feature story that changes a domain's tables adds its own migration; this story does not create feature tables (see Story 02 for the minimal foundation tables it does create: branches, departments, users, roles, permissions).
- **Attachments**: binary content in S3-compatible object storage; only metadata (key, filename, size, mime type, owning entity) lives in Postgres.
- **Full-text search**: Postgres `tsvector`/`tsquery` for Knowledge Base and ticket search initially (see [Technology Stack](./01-technology-stack.md) for the deferred upgrade path).
- **Embeddings**: the `pgvector` extension is enabled from the start so AI-assisted search/suggestions ([SLA, Automation & AI](./07-sla-automation-and-ai.md)) can store embeddings in the same database without introducing a separate vector store.

## Multi-branch / multi-department model

The intake describes **one company** operating **multiple branches**, each with **multiple departments** — not multiple independent customer companies (that would be multi-tenant SaaS, which is a different, harder problem). The data model reflects exactly that:

- `Organization` — a single row for now (the company running the CRM). Modeled explicitly (not hardcoded) so that if true multi-company SaaS is ever required later, the partitioning key already exists — see [Risks](./12-risks-tradeoffs-and-scope.md) for why this is called out as a risk rather than treated as already solved.
- `Branch` — belongs to `Organization`. E.g., a city or regional office.
- `Department` — belongs to `Branch`. E.g., Sales, Technical Support, Billing within a branch.
- Every scoped entity (tickets, customers, KB articles if branch-specific, SLA policies, etc.) carries `branchId` and, where relevant, `departmentId`.

## Enforcement: `TenantContext`

- On every authenticated request, `apps/api` resolves a request-scoped `TenantContext` from the JWT claims + the user's currently selected branch (a user can belong to multiple branches/departments with different roles in each — see [Auth & Security](./05-auth-and-security.md)).
- A shared Prisma extension / repository base applies `branchId` (and `departmentId` where applicable) filters automatically on every query that touches a scoped table, and stamps them on every insert. Application code cannot forget the filter because it is not the one writing the `WHERE` clause.
- Cross-branch access (e.g., a regional manager viewing multiple branches, or an escalation crossing departments) is an explicit, audited permission (see [Auth & Security](./05-auth-and-security.md)) — never a default.

## What this story does NOT build

No ticket/customer/SLA/KB tables. Only the schema-organization approach and the `TenantContext` mechanism are decided here; the minimal `identity` schema tables (organization, branch, department, user, role, permission) are created in [Story 02](./02-story-monorepo-scaffolding.md) as the seed every other domain depends on.
```

### 6 — Create `docs/architecture/05-auth-and-security.md`

```markdown
# Authentication, Authorization & Security

## Authentication

- **JWT access token** (≈15 minute lifetime) + **rotating refresh token** (httpOnly, `Secure`, `SameSite=Strict` cookie), issued by `IdentityModule` via Passport JWT strategy.
- Agents/admins authenticate against `identity.users`. Customers (portal) authenticate against a separate, lighter-weight flow (email + password or magic link) scoped to `PortalModule` — see [Supporting Domains](./08-supporting-domains.md) — but tokens carry an explicit `audience` claim (`agent` vs `customer`) so a customer token can never be accepted by an agent-only endpoint, and vice versa.
- SSO (OIDC/SAML) is **not built now**; the Passport strategy is structured so an additional strategy can be added later without touching the rest of the auth pipeline (explicitly deferred, see [Risks](./12-risks-tradeoffs-and-scope.md)).

## Authorization

- **Role-Based Access Control (RBAC)** as the primary model: `Role` ↔ `Permission` many-to-many (`identity` schema). A user can hold different roles in different branches/departments (e.g., Agent in Branch A, Department Lead in Branch B).
- **CASL** is used inside services for the fine-grained checks RBAC alone can't express cleanly (e.g., "an agent may view a ticket only if it is assigned to them or unassigned within their department, unless it has been escalated to them").
- Enforcement points: a global `AuthGuard` (authentication) + `PermissionsGuard` (`@RequirePermissions('ticket:reassign')`-style decorators) on every controller method; nothing relies on the frontend to hide an action as its only protection.

## Audit logging

- `admin.audit_logs` is an **append-only** table (no `UPDATE`/`DELETE` grants for the application's DB role) capturing: actor (user id, impersonation info if any), action, entity type + id, before/after diff (JSONB), branch/department context, IP address, timestamp.
- Written via a global NestJS interceptor on all mutating (`POST`/`PATCH`/`PUT`/`DELETE`) requests, plus explicit calls from services for sensitive actions that aren't simple CRUD (permission grants, data exports, bulk operations, login/logout, failed auth attempts).
- Audit logs are branch-scoped for read access (a branch manager sees their branch's audit trail) but never editable or deletable by any application role.

## Security boundaries

- **Network**: `apps/api` sits behind a reverse proxy/WAF in every real environment (local dev excepted); only `apps/api`'s public routes (auth, portal, webhooks) are internet-facing at all — everything else assumes an authenticated session.
- **Secrets**: never committed; loaded from environment variables validated at boot via a typed config module (`@nestjs/config` + `zod` schema) that fails fast on a missing/malformed secret rather than starting with an undefined value.
- **Input validation**: every controller input is a `class-validator`-decorated DTO; nothing untyped reaches a service.
- **Rate limiting**: NestJS Throttler on all public-facing endpoints (auth endpoints, portal endpoints, inbound webhooks) to blunt credential-stuffing and webhook-flooding.
- **Least privilege at the DB level**: the application's runtime DB role can read/write application tables but cannot alter schema; a separate migration role (used only by CI/deploy) owns schema changes.
- **Webhooks** (inbound email/WhatsApp/SMS/ERP, see [Integrations](./09-integrations.md)) are verified via the provider's signature scheme before being trusted, and are rate-limited and logged like any other public endpoint.
```

### 7 — Create `docs/architecture/06-communication-and-realtime.md`

```markdown
# Communication Channels, Real-Time, Background Jobs & Notifications

## Communication channel architecture

All inbound messages (email, WhatsApp, SMS, web form submissions, live chat) are normalized by the **Integration Hub** ([Integrations](./09-integrations.md)) into one internal shape — a `ChannelMessage` domain event (channel type, external thread id, sender, body, attachments, timestamps) — before `ChannelsModule` ever sees them. This means `ChannelsModule` and the ticketing/agent UI work against one message model regardless of which channel it came from; channel-specific quirks are absorbed at the adapter boundary, not spread through business logic.

- **Email**: inbound via provider webhook (e.g., SES/Postmark inbound parsing) or IMAP polling as a fallback; outbound via transactional email provider (SMTP API).
- **WhatsApp**: Meta WhatsApp Business Cloud API (webhook for inbound, REST for outbound).
- **SMS**: Twilio (or equivalent) — same inbound-webhook/outbound-REST shape as WhatsApp.
- **Live chat**: not a third-party channel — it is a first-class Socket.IO flow directly between the customer portal / web widget and `apps/api`, still normalized into the same `ChannelMessage` shape so a chat conversation can become a ticket the same way an email can.
- **Web forms**: a public, rate-limited `apps/api` endpoint that creates a `ChannelMessage` directly (no external provider).

Every channel ties back to a `ticketing.tickets` row (new ticket or existing thread) via `Ticket.externalRef` per channel/thread id, so an agent sees one conversation regardless of channel.

## Real-time communication

- **Socket.IO** server as a NestJS gateway, **Redis adapter** so it works correctly once `apps/api` runs as more than one instance.
- **Auth**: the socket handshake carries the same JWT used for REST calls; unauthenticated sockets are rejected.
- **Rooms**: `ticket:{id}` (live updates to one ticket's timeline/chat), `branch:{id}:notifications` (in-app notification stream), `agent:{id}:presence` (availability for live-chat routing).
- Used for: live chat delivery, ticket timeline updates (status/assignment changes appearing without a refresh), in-app notifications, agent presence for chat routing.

## Background jobs & asynchronous processing

- **BullMQ** on Redis, consumed by `apps/worker` (a separate process from `apps/api` — see [System Architecture Overview](./02-system-architecture-overview.md)).
- Initial queues:
  - `sla-timers` — evaluates response/resolution due dates, fires escalation events (business-hours aware).
  - `notifications` — renders and delivers a queued notification through the right channel adapter(s).
  - `integration-sync` — outbound sync to ERP/external systems, retried with backoff.
  - `ai-processing` — ticket summarization, suggested replies/categorization, chatbot turns that shouldn't block a request.
  - `reports-refresh` — recomputes reporting materialized views on a schedule.
- Anything slower than a simple DB read/write, or anything calling a third party (email/SMS/WhatsApp/ERP/AI provider), is enqueued from `apps/api` and executed by `apps/worker` — `apps/api` request handlers stay fast and do not depend on third-party uptime to respond.

## Notification architecture

- A single `NotificationService` (in `NotificationsModule`) is the only place that decides "who gets notified about what, on which channel(s)."
- Flow: a domain event (e.g., `ticket.assigned`) → `NotificationService` resolves the recipients + their channel preferences → renders a locale-aware template (see [i18n & RTL](./10-i18n-and-rtl.md)) → enqueues one `notifications` job per (recipient, channel) → the job calls the relevant channel adapter (in-app via Socket.IO + a DB row for history, or email/SMS/WhatsApp via the same adapters the Integration Hub uses for outbound messages) → delivery outcome is logged for retry/inspection.
- Users configure per-event channel preferences (e.g., "escalations by SMS + in-app, everything else in-app only").
```

### 8 — Create `docs/architecture/07-sla-automation-and-ai.md`

```markdown
# SLA & Automation, and AI Integration (high level)

These are foundation-level designs only — the concrete SLA/automation rule set and AI feature UX are built out in their own future stories. The goal here is to fix the *shape* so those stories don't have to design the plumbing.

## SLA & automation (high level)

- `SlaPolicy` (branch/department + category/priority scoped): response-time target, resolution-time target, business-hours calendar reference.
- A ticket gets its SLA targets computed (business-hours aware) when it is created or re-categorized, via a service in `SlaModule` reacting to `ticket.created` / `ticket.recategorized` domain events.
- The `sla-timers` background job (see [Communication & Real-Time](./06-communication-and-realtime.md)) periodically checks tickets against their targets and emits `sla.at_risk` / `sla.breached` events, which `NotificationsModule` and escalation rules react to.
- `AutomationRule` starts as a simple **trigger → condition → action** row evaluated against domain events (e.g., trigger `ticket.created`, condition `channel = email AND category = billing`, action `assign to Billing department`). A full workflow/rules engine is explicitly **not** built now (see [Risks](./12-risks-tradeoffs-and-scope.md)) — this is intentionally the simplest model that satisfies "automatic assignment" and "escalation rules" from the intake.

## AI integration (high level)

- `AiModule` exposes one internal interface, `AiProvider`, with methods such as `summarize(ticket)`, `suggestReply(ticket)`, `categorize(ticket)`, and `chat(session, message)`. All AI features in the product (ticket summaries, suggested replies, automatic categorization, suggested solutions, the AI chatbot) are built against this interface, not against a specific vendor SDK.
- The initial implementation of `AiProvider` calls the **Anthropic Claude API**. Swapping providers means implementing `AiProvider` again — no call site changes.
- AI calls are asynchronous (`ai-processing` queue) except where a synchronous response is core to the UX (e.g., interactive chatbot turns), which go through `apps/api` directly but still off the main request thread pool via the provider SDK's async client.
- Every AI call is logged (prompt reference, model, token usage, latency, outcome) for audit and cost visibility, and is feature-flaggable per branch so it can be rolled out gradually.
- **Human-in-the-loop by default**: AI output (summaries, suggested replies, suggested solutions) is presented to an agent for review/edit before it reaches a customer. Fully autonomous AI responses (the chatbot) are scoped to the customer portal's self-service flow, not to agent-owned tickets, in this foundation phase.
- Suggested solutions and the chatbot's retrieval step read from the Knowledge Base ([Supporting Domains](./08-supporting-domains.md)) using `pgvector` embeddings stored alongside KB articles.
```

### 9 — Create `docs/architecture/08-supporting-domains.md`

```markdown
# Supporting Domains (high level): Knowledge Base, Customer Portal, Reporting

## Knowledge Base (high level)

- `knowledge_base.articles` with categories/tags, draft/published workflow, versioning (new version on publish, not in-place mutation of a published article).
- Search: Postgres `tsvector` initially; `pgvector` embeddings added alongside articles from day one so AI suggested-solutions/chatbot retrieval ([SLA, Automation & AI](./07-sla-automation-and-ai.md)) can do semantic search without a schema change later.
- Consumed by three surfaces: agent app (search while handling a ticket), customer portal (self-service FAQs/guides), and the AI layer (retrieval for suggestions/chatbot).

## Customer Portal (high level)

- Separate frontend app, `apps/portal` (see [Technology Stack](./01-technology-stack.md)), because its audience, auth model, and branding surface differ from the agent app — not because it needs different backend infrastructure.
- Backend surface is a dedicated `PortalModule` in `apps/api` exposing only what a customer should be able to do: submit a ticket, view/track their own tickets, view history, browse the Knowledge Base, submit feedback/CSAT.
- Enforced at the data layer: every portal query is additionally scoped to `customerId = currentCustomer.id` on top of the normal branch/department scoping — a customer can never fetch another customer's ticket by guessing an id.

## Reporting & Analytics (high level)

- Starts as direct queries / materialized views (`reporting` schema) over the other domains' tables — ticket volume/aging, SLA performance, agent performance, CSAT — refreshed by the `reports-refresh` background job (see [Communication & Real-Time](./06-communication-and-realtime.md)).
- `ReportingModule` exposes read-only aggregate endpoints consumed by management dashboards in `apps/web`.
- A dedicated analytics warehouse (e.g., ClickHouse) is **not** introduced now; it's the documented scaling trigger in [Risks](./12-risks-tradeoffs-and-scope.md) if/when reporting query load or retention needs outgrow Postgres materialized views.

## Custom branding (cross-cutting note)

Branding (logo, colors, per-branch identity) is configuration data owned by `AdminModule` (`admin` schema) and consumed by both `apps/web` and `apps/portal` at render time (theme tokens resolved from branch config) — it is not a separate architectural layer, just a configuration source the frontend theming already needs to support via Tailwind CSS variables.
```

### 10 — Create `docs/architecture/09-integrations.md`

```markdown
# Integration Architecture (External Systems)

## Integration Hub

A single place (`IntegrationsModule` in `apps/api`, `integrations` schema) owns every connection to an external system. It has two directions:

- **Inbound**: provider webhooks (email parsing, WhatsApp, SMS) and any polling fallback land here first, are verified (signature/secret check), logged (`integrations.webhook_logs`), and translated into internal domain events (`ChannelMessage` for messaging channels — see [Communication & Real-Time](./06-communication-and-realtime.md); ERP-specific events for ERP sync).
- **Outbound**: domain events that need to reach an external system (send an email/SMS/WhatsApp message, push an update to the ERP) are enqueued onto the `integration-sync` BullMQ queue and executed by `apps/worker` through the relevant adapter, with retry/backoff and a durable log of the attempt.

## Adapter pattern

Each external system gets one adapter implementing a small, system-specific interface (e.g., `ErpAdapter { syncCustomer(), syncOrder() }`, `EmailAdapter { send(), parseInbound() }`). Adapters are the only code allowed to import a third-party SDK/HTTP client for that system — business logic (`ChannelsModule`, `CustomersModule`, etc.) depends on the adapter's interface, never on the vendor SDK directly. This is what makes "swap Twilio for another SMS provider" or "swap the ERP" a contained change.

## Public API (for external consumers)

- The same versioned REST API (`/api/v1/...`) documented via OpenAPI (see [System Architecture Overview](./02-system-architecture-overview.md)) is the platform's public integration surface — there is no separate "integration API."
- Machine-to-machine consumers (ERP, other external systems) authenticate via API keys initially; OAuth2 client-credentials is a documented future upgrade if a partner integration requires it (deferred, not built now).
- Inbound webhooks from providers (not to be confused with outbound calls the platform makes) are unauthenticated-but-signed per the provider's scheme (e.g., Twilio request signatures, Meta's `X-Hub-Signature-256`) and are rate-limited like any other public endpoint (see [Auth & Security](./05-auth-and-security.md)).

## ERP integration

Modeled as just another adapter (`ErpAdapter`) behind the same Integration Hub — no assumption is made yet about which ERP or its protocol (REST/SOAP/file-based); the adapter interface is the contract future stories implement against once a specific ERP is named.
```

### 11 — Create `docs/architecture/10-i18n-and-rtl.md`

```markdown
# Internationalization (Arabic/English) & RTL

## Content strategy

- **UI strings**: `next-intl` JSON catalogs, `messages/en.json` and `messages/ar.json`, in both `apps/web` and `apps/portal`. No hardcoded UI text in components.
- **User-generated / domain content that needs translation** (e.g., Knowledge Base articles): a `translations` pattern — one row per (entity id, locale, field) or a `Json` column keyed by locale on the owning table (decided per-entity in the story that builds that entity) — not a second copy of the whole entity per language.
- **Locale selection**: per-user preference (stored on `identity.users`), overridable per-session; portal customers can pick their locale independently of any agent-side setting.

## RTL strategy

- Root layout sets `dir="rtl"` when the active locale is `ar`, `dir="ltr"` otherwise — driven by `next-intl`'s locale, not by manual per-page logic.
- Tailwind CSS is used with **logical properties** (`ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`) instead of physical left/right utilities (`ml-*`/`mr-*`) everywhere, so the same component tree mirrors correctly under `dir="rtl"` without an RTL-specific style branch.
- shadcn/ui (Radix-based) components are RTL-aware by default when the `dir` attribute is set on an ancestor — no fork of the component library is needed.
- Icons/illustrations that are directional (arrows, chevrons) are flipped via a CSS rule scoped to `[dir="rtl"]`, decided per-component as they're built, not solved globally here.

## Formatting

- Dates, numbers, and currency use `Intl` APIs (`Intl.DateTimeFormat`, `Intl.NumberFormat`) driven by the active locale — never manually formatted strings.
- Each `Branch` carries an IANA timezone used for SLA business-hours calculations ([SLA, Automation & AI](./07-sla-automation-and-ai.md)) and for displaying timestamps in the branch's local time, independent of UI locale (a branch's timezone and a user's display language are different concerns and must not be conflated).
```

### 12 — Create `docs/architecture/11-quality-and-operations.md`

```markdown
# Testing, Observability, Deployment & Environments

## Testing strategy

- **Unit tests** (Vitest): business logic in NestJS services, pure functions/utilities, React components in isolation (Testing Library).
- **API integration tests** (Vitest + Supertest): exercise real controllers against a real Postgres instance (via `docker-compose`'s test profile or Testcontainers), one suite per module.
- **End-to-end tests** (Playwright): a small number of critical happy-path flows (agent logs in and resolves a ticket; customer submits a ticket via the portal) — E2E coverage stays intentionally shallow; it is not where business-rule coverage lives.
- Every future feature story is expected to add unit tests for its business logic and at least one integration test for its API surface as part of that story's own Done Criteria — this story only fixes the tooling/conventions, it does not write feature tests (there are no features yet).

## Observability

- **Logging**: structured JSON logs via `pino`, one correlation/request id per request propagated from `apps/api` into any `apps/worker` job it enqueues, so a request and the jobs it caused can be traced together.
- **Tracing**: OpenTelemetry SDK instrumenting HTTP, Prisma, and BullMQ, exported to a self-hostable backend (Grafana Tempo) by default — swappable for a hosted APM later without changing instrumentation code (OTel is the abstraction).
- **Metrics**: Prometheus-format `/metrics` endpoint on `apps/api` and `apps/worker` (request rates/latency, queue depth/processing time), scraped by Prometheus, visualized in Grafana.
- **Error tracking**: Sentry (or self-hosted GlitchTip) on both frontend and backend for unhandled exceptions.
- **Health checks**: `/health` (liveness) and `/health/ready` (readiness — checks DB/Redis connectivity) on `apps/api` and `apps/worker`, used by container orchestration and by local `docker-compose` health checks.

## Deployment & environments

- **Environments**: local (`docker-compose`), staging, production. Configuration is environment variables validated at boot (`@nestjs/config` + `zod`) — no environment-specific code branches.
- **CI** (GitHub Actions): on every PR — install, lint, type-check, unit + integration tests, build all `apps/*`; on merge to the main branch — additionally build and push Docker images. A deploy step is intentionally **not** part of this story's scope (see [Risks](./12-risks-tradeoffs-and-scope.md) — production deployment is explicitly out of scope for this feature).
- **Containers**: every app (`web`, `portal`, `api`, `worker`) ships a Dockerfile; `docker-compose.yml` at the repo root runs Postgres, Redis, MinIO, and a mail-catcher (e.g., MailHog) for local development, plus the four apps.
- **Migrations**: run as an explicit step (`prisma migrate deploy`) before the new API/worker version starts serving traffic in any environment beyond local dev — never run implicitly on app boot.
```

### 13 — Create `docs/architecture/12-risks-tradeoffs-and-scope.md`

```markdown
# Risks, Trade-offs & Explicit Non-Goals

## Key trade-offs made in this architecture

| Trade-off | Choice made | Why | Revisit when |
|---|---|---|---|
| Modular monolith vs. microservices | Modular monolith (`apps/api`) with in-process domain events | Avoids distributed-systems complexity (network calls, partial failure, distributed transactions) before there is a proven need; module boundaries + domain events (see [Domain Boundaries](./03-domain-boundaries.md)) make future extraction possible without a rewrite | A specific module (Integrations, AI Gateway, or Notifications are the most likely) needs independent scaling, independent deploys, or hits a resource contention problem with the rest of the API |
| Single database, multiple logical schemas vs. database-per-domain | Single Postgres database, one logical schema per domain | One database is far cheaper to operate, back up, and query across domains (reporting needs this); schema-per-domain still gives a clean seam to split later | A domain's data volume or availability requirements diverge enough to justify its own database |
| REST vs. GraphQL | REST + OpenAPI | Matches a CRUD/workflow-heavy surface; simpler caching, simpler tooling, simpler for external/ERP integrations to consume | A concrete consumer (e.g., a mobile app doing complex nested fetches) makes REST's over/under-fetching a real problem |
| Self-hosted auth vs. auth vendor (Auth0/Clerk/etc.) | Self-hosted JWT + RBAC/CASL | Full control over the branch/department claim model, audit requirements, and no per-user vendor billing for an internal tool; SSO strategy slot left open | A concrete need for enterprise SSO (SAML/OIDC with a specific customer IdP) arrives |
| Build vs. buy for channel providers | Buy (Twilio/Meta/SES-class providers), build only the orchestration/adapter layer | Building SMS/WhatsApp/email delivery infrastructure from scratch is not the product's value proposition | Not expected to be revisited |
| AI vendor | Anthropic Claude behind an `AiProvider` interface | Strong reasoning/summarization quality; interface avoids lock-in | Cost, latency, or a specific feature need makes a different/second provider worth adding |
| Search technology | Postgres `tsvector` (+ `pgvector` for embeddings) | No new infrastructure until proven necessary | KB/ticket search relevance or latency becomes a measured problem |
| Analytics | Postgres materialized views | No new infrastructure until proven necessary | Reporting query latency or retention needs outgrow Postgres |
| Multi-branch (not multi-company) data model | `Organization` (single row) → `Branch` → `Department` | Matches the actual requirement (one company, many branches) without building multi-tenant SaaS complexity that isn't needed | The business genuinely needs to host multiple separate customer companies — this would need row-level security and a harder look at data isolation guarantees, not just a bigger `Organization` table |

## Major technical risks

1. **RTL/i18n regressions**: any component built without logical CSS properties will silently break under Arabic/RTL. Mitigation: the convention is fixed in [i18n & RTL](./10-i18n-and-rtl.md); future code review should treat a physical-direction utility class (`ml-`, `mr-`, `left-`, `right-`) in new code as a defect, not a style nit.
2. **Domain-event discipline erosion**: it is easy, under deadline pressure, for a module to import another module's service directly "just this once." Left unchecked this quietly turns the modular monolith into a tangled one, closing off the extraction path the architecture depends on.
3. **AI cost/latency**: synchronous AI calls (chatbot) on the request path can degrade `apps/api` responsiveness or get expensive at scale; mitigated by keeping non-interactive AI work (summaries, categorization) fully asynchronous via `ai-processing`, but the chatbot path needs its own latency/cost monitoring once built.
4. **Single-organization assumption**: the data model is deliberately not multi-tenant SaaS (see trade-off table). If that assumption turns out to be wrong, it is a data-model migration, not a config change.
5. **Undecided production hosting platform**: local/staging both run on `docker-compose`, but production topology (Kubernetes vs. managed containers vs. PaaS) is unresolved. This is safe to defer (containers run anywhere) but must be resolved before any production deployment story, not discovered mid-deployment.

## Explicit non-goals of this foundation story

The following are **not** produced by this story or [Story 02](./02-story-monorepo-scaffolding.md), by design (per the intake's "Out of scope" section):

- Any customer management, ticketing, SLA, automation, KB, AI, portal, reporting, admin, or integration **feature** implementation.
- The complete database schema (only the minimal `identity` tables needed to prove multi-branch/department scoping are created, in Story 02).
- Complete API endpoints beyond health checks and auth scaffolding.
- Complete frontend screens beyond a placeholder/health page per app.
- Any production deployment or third-party account provisioning (Twilio/Meta/AWS/etc. accounts are not created; adapters are built against interfaces and can be wired to real credentials later).
- A resolved production hosting platform decision (see risk 5 above).
```

---

## Traceability — Acceptance Criteria → Document

| Intake acceptance criterion | Document |
|---|---|
| Recommended stack, justified | [01-technology-stack.md](../../../docs/architecture/01-technology-stack.md) |
| Frontend architecture | [02-system-architecture-overview.md](../../../docs/architecture/02-system-architecture-overview.md) |
| Backend/API architecture | [02-system-architecture-overview.md](../../../docs/architecture/02-system-architecture-overview.md) |
| Database strategy | [04-data-and-multitenancy.md](../../../docs/architecture/04-data-and-multitenancy.md) |
| Core domain boundaries | [03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) |
| Auth/authz architecture | [05-auth-and-security.md](../../../docs/architecture/05-auth-and-security.md) |
| Multi-branch/department architecture | [04-data-and-multitenancy.md](../../../docs/architecture/04-data-and-multitenancy.md) |
| Arabic/English/RTL | [10-i18n-and-rtl.md](../../../docs/architecture/10-i18n-and-rtl.md) |
| Communication channel architecture | [06-communication-and-realtime.md](../../../docs/architecture/06-communication-and-realtime.md) |
| Real-time requirements | [06-communication-and-realtime.md](../../../docs/architecture/06-communication-and-realtime.md) |
| Background jobs / async processing | [06-communication-and-realtime.md](../../../docs/architecture/06-communication-and-realtime.md) |
| Notification architecture | [06-communication-and-realtime.md](../../../docs/architecture/06-communication-and-realtime.md) |
| SLA & automation (high level) | [07-sla-automation-and-ai.md](../../../docs/architecture/07-sla-automation-and-ai.md) |
| Knowledge Base (high level) | [08-supporting-domains.md](../../../docs/architecture/08-supporting-domains.md) |
| AI integration (high level) | [07-sla-automation-and-ai.md](../../../docs/architecture/07-sla-automation-and-ai.md) |
| Customer Portal (high level) | [08-supporting-domains.md](../../../docs/architecture/08-supporting-domains.md) |
| Reporting & analytics (high level) | [08-supporting-domains.md](../../../docs/architecture/08-supporting-domains.md) |
| Integration architecture (external systems) | [09-integrations.md](../../../docs/architecture/09-integrations.md) |
| Security boundaries + audit logging | [05-auth-and-security.md](../../../docs/architecture/05-auth-and-security.md) |
| Testing strategy (high level) | [11-quality-and-operations.md](../../../docs/architecture/11-quality-and-operations.md) |
| Logging/monitoring/observability | [11-quality-and-operations.md](../../../docs/architecture/11-quality-and-operations.md) |
| Deployment & environment strategy | [11-quality-and-operations.md](../../../docs/architecture/11-quality-and-operations.md) |
| Major technical risks & trade-offs | [12-risks-tradeoffs-and-scope.md](../../../docs/architecture/12-risks-tradeoffs-and-scope.md) |
| Explicit non-goals of this foundation story | [12-risks-tradeoffs-and-scope.md](../../../docs/architecture/12-risks-tradeoffs-and-scope.md) |
| Enough detail for future stories to build on | All documents — each names concrete modules, schemas, queues, and interfaces future stories implement against, rather than leaving them to redesign |

---

## Verification Steps

1. **File check:** confirm `docs/architecture/README.md` and all 12 numbered documents listed above exist with the content specified.
2. **Link check:** open `docs/architecture/README.md` and confirm every link resolves to a file that exists.
3. **Traceability check:** walk the acceptance criteria in `.squad/stories/project-foundation/project-foundation/intake.md` one by one against the table above; every criterion must point at a document that actually contains that content (not just a mention).
4. **Scope check:** confirm no application code, `package.json`, database migration, or CI file was added in this story — `git status` (or the workspace diff) should show only new files under `docs/architecture/` plus the updates to `.squad/plans/project-foundation/00-overview.md` and `.squad/plans/00-index.md`.

## Done Criteria

- [ ] `docs/architecture/README.md` exists and links to all 12 sub-documents.
- [ ] All 12 sub-documents exist with the content specified in this plan (adapted only where something here is demonstrably already contradicted elsewhere in this same plan — not on the executor's own judgment).
- [ ] Every acceptance criterion in the intake maps to a specific document per the Traceability table.
- [ ] No application code, database schema, or infrastructure was created in this story.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to [Story 02](./02-story-monorepo-scaffolding.md).**
