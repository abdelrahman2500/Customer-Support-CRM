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
3. Cross-domain communication inside `apps/api` (e.g., "ticket created" needs to notify SLA, Notifications, and AI modules) happens through in-process domain events (NestJS `EventEmitter2`), not by one module importing and calling another module's internals directly.
4. Any module that outgrows the in-process model (needs independent scaling, independent deploys, or a different language/runtime) is extracted into its own service communicating over Redis Streams or a proper broker.

## Frontend architecture (`apps/web`, `apps/portal`)

- **Routing**: Next.js App Router, route groups per top-level section (`(agent)`, `(admin)`, `(auth)` in `apps/web`; `(portal)` in `apps/portal`), locale-prefixed routes (`/en/...`, `/ar/...`) via `next-intl`.
- **Data fetching**: Server Components fetch initial data server-side (calling `apps/api` with the request's forwarded auth cookie); client-side interactivity (live updates, mutations, optimistic UI) uses TanStack Query.
- **State**: Server state lives in TanStack Query's cache. Local-only UI state uses small Zustand stores scoped to a feature, not one global store.
- **Real-time**: a single Socket.IO client connection per app, established after auth, subscribed to rooms relevant to the current view (`ticket:{id}`, `branch:{id}:notifications`); incoming events invalidate or patch the relevant TanStack Query cache entries.
- **Styling/components**: Tailwind CSS with logical properties, shadcn/ui components copied into `packages/shared` (or a dedicated `packages/ui`) so both apps render consistent, brandable components.

## Backend/API architecture (`apps/api`)

- **Module-per-domain**: one NestJS module per bounded context in [Domain Boundaries](./03-domain-boundaries.md) (`IdentityModule`, `CustomersModule`, `TicketingModule`, `ChannelsModule`, `SlaModule`, `KnowledgeBaseModule`, `AiModule`, `NotificationsModule`, `ReportingModule`, `PortalModule`, `AdminModule`, `IntegrationsModule`). Each module owns its controllers, services, and Prisma models.
- **Layering inside a module**: `*.controller.ts` (HTTP/DTO boundary, validation via `class-validator`) → `*.service.ts` (business logic) → Prisma client (persistence). Controllers never call Prisma directly.
- **Cross-cutting concerns as global providers**: authentication guard, authorization (permissions) guard, `TenantContext` (branch/department scoping, see [Data & Multi-Tenancy](./04-data-and-multitenancy.md)), audit-logging interceptor, request-id/logging interceptor.
- **API versioning**: all routes under `/api/v1`; breaking changes get a new version prefix rather than mutating v1 contracts once a frontend or external integration depends on them.
- **OpenAPI**: generated from Nest decorators (`@nestjs/swagger`), published at `/api/docs` in non-production environments; this is also the contract external integrations are written against.
