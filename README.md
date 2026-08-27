# Customer Support CRM

A full-stack Customer Support CRM platform: multi-branch/multi-department
ticketing, multi-channel communication (email, WhatsApp, SMS, live chat, web
forms), SLA/automation, a Knowledge Base, AI-assisted agent tooling, a
customer self-service portal, reporting, and administration — in Arabic and
English with full RTL support.

See **[docs/architecture/README.md](./docs/architecture/README.md)** for the
full target architecture — every technology choice, domain boundary, and
cross-cutting concern is decided and documented there. Read it before
proposing a design for any new feature. This README covers only what's
needed to install, configure, and run the project as it exists today.

## Current state (through Story 32, with one gap — see "Known gap" below)

Implemented so far:

- **Identity & Access**: branches/departments/users/roles/permissions, JWT
  access + refresh tokens, seeded SuperAdmin.
- **Customer Management**: customers and contacts, branch-scoped CRUD.
- **Ticketing**: tickets, assignment, status/priority/category, history/
  timeline, domain events (`ticket.created`/`updated`/`recategorized`/
  `escalated`).
- **SLA & Automation (foundation)**: SLA policies, business-hours calendars,
  business-hours-aware target computation, SLA timer detection
  (`sla.at_risk`/`sla.breached`) via a BullMQ-backed `apps/worker`, breach
  escalation, and `NotificationLog`-based logging of at-risk/escalation
  events. `AutomationRule` itself is not implemented.
- **Realtime (Socket.IO)**: an authenticated gateway with two room types —
  `ticket:{id}` (ticket-scoped updates) and `branch:{id}:notifications`
  (branch-wide SLA/escalation broadcasts) — both backed by a Redis adapter
  for horizontal scaling.
- **Agent Workspace** (`apps/web`): real sign-in, an authenticated workspace
  shell, a ticket list (filter by status/priority/category/assigned agent,
  sort by created/updated time — no search or pagination yet), ticket
  detail (customer info, SLA target, history, and status/priority/category/
  assignment actions), and live updates to an open ticket via `ticket:{id}`.
- **In-app notifications** (Agent Workspace): the workspace joins
  `branch:{id}:notifications` once per session and shows `sla.at_risk`,
  `sla.breached`, and `ticket.escalated` events as transient, dismissible
  toasts with click-through to the relevant ticket. There is no
  notification center, history, persistence, read/unread state, or
  per-user recipient targeting — every agent connected to a branch sees the
  same branch-wide broadcasts.
- **Ticket & customer creation** (Agent Workspace): `tickets/new` and
  `customers/new` let an agent create a ticket (for an existing customer)
  or a customer, using the existing `POST /tickets`/`POST /customers`
  contracts — no new backend endpoint. Customer selection reuses the same
  full customer list already fetched elsewhere in the workspace (no
  search/autocomplete endpoint exists yet); a successful ticket creation
  opens the new ticket's real detail page.
- **Customer list & detail** (Agent Workspace): `customers` lists every
  customer in the branch (name + active/inactive status, no search/
  pagination — same accepted limitation as the ticket list); `customers/{id}`
  shows a customer's contacts read-only, using `GET /customers/:id`'s
  already-embedded contacts (no second request). A "View customer" link is
  available wherever the ticket list/detail already shows a customer name.
- **Customer-to-ticket navigation** (Agent Workspace): a customer's detail
  page now has a "Related tickets" section, derived by filtering the
  existing, already-fetched, unpaginated `GET /tickets` result client-side
  by `customerId` (no backend `customerId` filter parameter exists), plus a
  "New ticket" action that opens `tickets/new?customerId=<id>`. The Create
  Ticket screen reads that optional query parameter and pre-selects the
  matching customer in the existing picker — the agent can still change the
  selection — with no change to behavior when the parameter is absent or
  doesn't match a loaded customer.
- **Real Agent Dashboard** (Agent Workspace): `dashboard` (previously a
  redirect to `tickets`) now shows the authenticated agent's own open
  (`OPEN`/`IN_PROGRESS`) tickets, fetched via the existing `GET
  /tickets?assignedToUserId=<their own id>` filter — never the branch-wide
  list — and ordered breached-first, then soonest-remaining-SLA-target,
  then no-target-last, using the existing `deriveSlaStatus` helper (no new
  "at risk" threshold). No filter/sort/search UI; `RESOLVED`/`CLOSED`
  tickets are excluded (this is a work queue, not a history).
- **Unassigned tickets & self-assign** (Agent Workspace): the Dashboard has
  a second "Unclaimed tickets" section — the same unfiltered `GET /tickets`
  call other screens already make, narrowed client-side to
  `assignedToUserId === null` and an open status, ordered by the same SLA
  urgency as "My open tickets". Each row has a "Claim" action that sends
  the existing `PATCH /tickets/:id` with `{ assignedToUserId: <the current
  agent's own id> }` — the same endpoint, DTO field, and `ticket:update`
  permission `TicketDetailView`'s assignee picker already uses; no new
  backend contract. The existing Ticket List is unchanged — it still has
  no "Unassigned" filter option, since the backend has no way to filter
  for "no assignee" and this story didn't add one. Already-assigned
  tickets are never claimable through this section.
- **Customer & contact editing** (Agent Workspace): a customer's detail page
  now has an editable display name and active/inactive select, both
  committing on blur/change via the existing `PATCH /customers/:id` — no
  new backend endpoint/DTO. Each contact is inline-editable (fullName/
  email/phone, blur-commit) and has a "set/unset primary" toggle, all via
  the existing `PATCH /customers/:id/contacts/:contactId`; a new contact
  can be added via the existing `POST /customers/:id/contacts`. Every
  mutation is never-optimistic (re-fetches the real state on success only)
  and distinguishes a 403 from a generic failure inline, the same
  convention as `TicketDetailView`.
- **User management** (Agent Workspace): a new `/users` route lists every
  user in the branch via the existing `GET /identity/users` (its
  `UserSummary` now additionally returns `isActive`/`roles`, already
  present server-side). `fullName` is inline-editable (blur-commit) and
  active/inactive is toggleable, both via the existing
  `PATCH /identity/users/:id` — no new backend endpoint/DTO. Roles render
  as read-only badges (no role-assignment endpoint exists). User creation
  is explicitly out of scope: `CreateUserDto` requires a real
  `branchId`/`roleId` and no endpoint exists anywhere to list valid
  branches/departments for a form to populate.

Not implemented yet: Communication Channels (email/WhatsApp/SMS/live chat/
web forms), Knowledge Base, AI services, Customer Portal (`apps/portal` is
still a placeholder), Reporting & Analytics, Administration screens (role/
permission management, user creation, audit log viewing), Integrations,
`AutomationRule`, agent presence, ticket/customer search, pagination, bulk
import, attachments, ticket comments, and SLA policy management (planned
as Story 31 — see "Known gap" below).

## Repository layout

```
apps/
  web/      Next.js — the Agent Workspace (implemented: auth, tickets, in-app notifications)
  portal/   Next.js — customer-facing portal (placeholder only)
  api/      NestJS — HTTP API (REST) + Socket.IO gateway
  worker/   NestJS standalone — BullMQ background job worker (SLA timers)
packages/
  shared/   Shared TypeScript types/DTOs used by the API and both frontends
  config/   Shared tsconfig / ESLint / Prettier configuration
docs/
  architecture/  The target-architecture source of truth — read this first
.squad/
  plans/, stories/  Per-story implementation plans and intakes
```

## Technology stack

- **Backend**: NestJS 11, Prisma 6 (PostgreSQL 16 + `pgvector`), BullMQ on
  Redis, Socket.IO with `@socket.io/redis-adapter`, JWT auth (`@nestjs/jwt`
  + Passport), class-validator DTOs, Swagger (dev only).
- **Frontend**: Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS,
  a small hand-built shadcn/ui-style component set (`components/ui/`),
  TanStack Query for server state, Zustand for the transient notification
  store, `socket.io-client`, `next-intl` for English/Arabic i18n and RTL.
- **Testing**: Vitest (unit + component) across every package; Supertest-
  driven e2e suites in `apps/api/test/` against a real Postgres/Redis.
- **Local infra**: Docker Compose (Postgres+pgvector, Redis, MinIO, MailHog).

## Prerequisites

- Node.js 20+
- pnpm 10 (`corepack enable` or `npm install -g pnpm@10`)
- Docker Desktop, with its WSL2 backend healthy (Windows). Docker Desktop's
  own Windows service must be running — if `docker ps` fails with a pipe
  connection error, check `Get-Service com.docker.service` and start it (as
  an administrator) before continuing.
- On Windows specifically: if a native PostgreSQL service is already
  running on port 5432, Docker's own Postgres container is unreachable on
  that port even though it starts and reports healthy. `docker-compose.yml`
  currently maps `postgres` to host port **5433** (`5433:5432`) for exactly
  this reason. **`.env.example`'s `DATABASE_URL` still says `5432`** — this
  is a known, currently-unreconciled mismatch between the two committed
  files; when copying `.env.example`, change the port to match whatever
  `docker compose ps` actually shows for `postgres` on your machine (5433
  today, or 5432 if you've reverted the compose mapping back because you
  don't have a conflicting native Postgres).

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Start local infrastructure (Postgres + pgvector, Redis, MinIO, MailHog)
docker compose up -d
# Only Postgres and Redis are required for the app itself:
#   docker compose up -d postgres redis

# 3. Copy environment templates and adjust if needed (defaults match docker-compose.yml)
cp .env.example apps/api/.env
cp .env.example apps/worker/.env   # only REDIS_URL/NODE_ENV are read
echo 'NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"' > apps/web/.env.local
echo 'NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"' > apps/portal/.env.local

# 4. Apply the database schema and seed a SuperAdmin + default branch
pnpm --filter @crm/api exec prisma migrate deploy
pnpm --filter @crm/api prisma:seed

# 5. Run everything
pnpm dev
```

### Environment variables (`apps/api/.env`, see `.env.example`)

| Variable | Purpose |
|---|---|
| `NODE_ENV`, `PORT` | Runtime mode and HTTP port (default `3001`). |
| `DATABASE_URL` | Postgres connection string. |
| `REDIS_URL` | Redis connection string (BullMQ + Socket.IO adapter). |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_TTL` | Access-token signing (min 32 chars). |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_TTL_DAYS` | Refresh-token signing. |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | Object storage config (not yet used by any implemented feature). |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins for both the REST API and the Socket.IO gateway. Unset = no cross-origin access allowed. For local development: `http://localhost:3000`. Never put a production origin here — that's supplied by the deployment environment. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Read only by the seed script, to create the initial SuperAdmin. |

`apps/web/.env.local` / `apps/portal/.env.local` need only `NEXT_PUBLIC_API_URL`.

### Ports

| App/service | URL |
|---|---|
| `apps/web` (Agent Workspace) | http://localhost:3000 |
| `apps/portal` (customer portal, placeholder) | http://localhost:3002 |
| `apps/api` (HTTP API + Socket.IO + Swagger docs) | http://localhost:3001 (docs at `/api/docs`) |
| `apps/worker` | no HTTP port — logs to the console |
| Postgres (Docker) | localhost:5433 (see the port-conflict note above) |
| Redis (Docker) | localhost:6379 |
| MinIO / MailHog (Docker, optional) | 9000/9001, 8025 |

## Common commands

```bash
pnpm dev         # turbo run dev — all apps
pnpm build       # turbo run build — all apps/packages
pnpm lint        # turbo run lint
pnpm typecheck   # turbo run typecheck
pnpm test        # turbo run test — unit/component tests only, every package
pnpm format      # prettier --write .
```

Run any of the above for a single package with `pnpm --filter @crm/api <script>`
(or `@crm/web`, `@crm/worker`, `@crm/portal`, `@crm/shared`).

### Tests

```bash
pnpm --filter @crm/api test        # unit tests
pnpm --filter @crm/api test:e2e    # integration tests — needs real Postgres + Redis running
pnpm --filter @crm/web test        # unit + component tests (Vitest + Testing Library)
pnpm --filter @crm/worker test     # unit tests
```

`test:e2e` boots the real `AppModule` against the Postgres/Redis started in
step 2 above — it will fail with connection errors if they aren't running.

## Realtime capabilities

The Socket.IO gateway (`apps/api/src/realtime/`) authenticates the
handshake with the same JWT used by the REST API and exposes two room
types, joined explicitly by the client after connecting:

- `ticket:{id}` — an agent viewing a ticket's detail page joins this and
  receives `ticket.updated`/`ticket.escalated` for that ticket only.
- `branch:{id}:notifications` — every authenticated agent's workspace joins
  this once per session (not per page) and receives `sla.at_risk`,
  `sla.breached`, and `ticket.escalated` for their own branch, rendered as
  transient toast notifications with click-through to the relevant ticket.

Both rooms are branch-scoped and enforced server-side; a socket can't join
a room outside its own branch. There is no agent-presence room, no live
chat, and no per-user notification targeting implemented.

## Verification status

Backend routes, filters/sorting, SLA-target reads, ticket mutations,
ticket/customer creation, `GET /customers`/`GET /customers/:id` (including
its embedded contacts), CORS, and both realtime rooms (including live
`sla.at_risk`/`sla.breached`/`ticket.escalated` delivery to a real
Socket.IO client) have been verified against a real running API, Postgres,
and Redis, and the new `customers`/`customers/{id}` routes are confirmed to
return real HTTP responses and to redirect an unauthenticated visitor to
login exactly like every other Agent Workspace route. The customer list's
static chrome (title, "New customer" button) is confirmed present in real
server-rendered HTML; a customer's actual name/status/contacts are fetched
client-side after hydration (TanStack Query, no SSR data-fetch), so — like
every other per-record value in this workspace — their on-screen rendering
is proven by real API-shape-matching component tests, not by a raw HTTP
fetch of the page. Actual browser/DOM click-through verification (as
opposed to the underlying API/socket calls and component tests it depends
on) requires a browser automation capability not available in every
environment this project has been developed in — where it hasn't been
performed, it is not claimed as done.

Story 27's customer-to-ticket navigation was verified against the same real
running API/Postgres: a real `GET /tickets` call against the seeded local
data confirmed multiple tickets sharing one real `customerId` (the exact
condition the "Related tickets" client-side filter depends on), a real
`GET /customers/:id` call for that same customer succeeded, and a real
`POST /tickets` call with that `customerId` — the same payload shape the
prefilled Create Ticket form would submit — succeeded and returned a new
ticket carrying the same `customerId`. Both modified routes
(`customers/{id}`, `tickets/new?customerId=...`) were confirmed to redirect
an unauthenticated request to login, same as every other workspace route.
The Related Tickets list itself and the picker's pre-selected option are
client-fetched/client-state, so — consistent with the rest of this
section — their on-screen rendering is proven by component tests, not by a
raw HTTP fetch of the page; no browser/DOM click-through verification is
claimed for this story either.

Story 28's Real Agent Dashboard was verified against the same real running
API/Postgres: a real login, a real `GET /auth/me` call, and a real `GET
/tickets?assignedToUserId=<that id>` call confirmed the filter genuinely
narrows the result (46 tickets scoped to the authenticated user out of 476
branch-wide, every one of the 46 actually carrying that user's id) rather
than merely succeeding. `/dashboard` was confirmed, via real HTTP requests,
to return `200` for an authenticated request (with the real static page
chrome — "Dashboard"/"My open tickets" — present in the raw server-rendered
HTML) and to still redirect an unauthenticated request to `login`, same as
every other workspace route. The populated ticket list itself is
client-fetched, so — consistent with the rest of this section — its
on-screen rendering is proven by component tests, not by a raw HTTP fetch
of the page; no browser/DOM click-through verification is claimed for this
story either.

Story 29's unassigned-tickets queue was verified against the same real
running API/Postgres: a real `GET /tickets` call confirmed a large,
concrete population of real unassigned open tickets (452–453 at
verification time, out of just over 500 total — the exact count drifts as
prior stories' own live-verification calls have each created one real
ticket), then a real `PATCH /tickets/:id` claim was performed against one
of them, setting `assignedToUserId` to the authenticated user's real id.
A re-fetch of that same ticket confirmed the assignment genuinely changed
(`null` → the real user id), a re-fetch of the branch-wide list confirmed
the unassigned count dropped by exactly one, and the ticket's own history
endpoint showed the existing `TicketHistoryListener` recorded a normal
`ticket.updated` entry for it — the identical mechanism `TicketDetailView`'s
assignee picker already relies on. **This claim is a real, permanent side
effect on the local development database**, reported honestly rather than
undone. The Unclaimed Tickets list itself is client-fetched, so —
consistent with the rest of this section — its on-screen rendering is
proven by component tests, not by a raw HTTP fetch of the page; no
browser/DOM click-through verification is claimed for this story either.

## Status by story

- ✅ 01–05 — Project foundation (stack, monorepo, identity/auth)
- ✅ 06 — Customer Management
- ✅ 07–09 — Ticketing foundation, domain events, history/timeline
- ✅ 10–13 — SLA policy foundation, target computation, business-hours calendar
- ✅ 14 — Background job producer foundation
- ✅ 15 — SLA timer detection (`sla.at_risk`/`sla.breached`)
- ✅ 16 — Ticket recategorization SLA target recomputation
- ✅ 17 — SLA breach escalation
- ✅ 18–19 — SLA-at-risk / ticket-escalation notification logging
- ✅ 20 — Realtime / Socket.IO foundation
- ✅ 21 — Ticket history/timeline completion
- ✅ 22 — In-app notification delivery (backend publisher)
- ✅ 23 — Agent Workspace: Ticket Operations MVP
- ✅ 24 — Agent Workspace: In-App Notification Display (implemented directly
  from a supplied specification; no `.squad` plan/intake exists for it)
- ✅ 25 — Agent Workspace: Ticket & Customer Creation
- ✅ 26 — Agent Workspace: Customer List & Detail
- ✅ 27 — Agent Workspace: Customer-to-Ticket Navigation
- ✅ 28 — Agent Workspace: Real Agent Dashboard
- ✅ 29 — Agent Workspace: Unassigned Tickets & Self-Assign
- ✅ 30 — Agent Workspace: Customer & Contact Editing
- ❌ 31 — Agent Workspace: SLA Policy Management — **reported complete but not
  present in this repository**; treat as not implemented — see "Known gap"
  below.
- ✅ 32 — Agent Workspace: User Management (list, deactivate, rename)
- ⏭ Everything else in the target architecture (Channels, Knowledge Base,
  AI, Customer Portal, Reporting, Administration, Integrations,
  `AutomationRule`, agent presence, search, pagination) — see
  `.squad/plans/` for planned work.

## Known gap: Story 31 (SLA Policy Management) is not in this repository

Stories 30–32 (`agent-workspace-customer-editing`,
`agent-workspace-sla-policy-admin`, `agent-workspace-user-admin`) were
developed as one parallel batch and each independently reported complete.
A reconciliation pass across the combined repository state found Story
30's and Story 32's implementations both present and coherent, but **Story
31's implementation was never committed to this repository** — only its
plan/story-intake documents exist
(`.squad/plans/agent-workspace-sla-policy-admin/`,
`.squad/stories/agent-workspace-sla-policy-admin/`). There is no
`apps/web/src/lib/sla-policies-api.ts`, no `use-sla-policies.ts` hook, no
`/sla-policies` route/component, and no commit referencing it. Its planned
scope — SLA policy list/create/edit-target-minutes/active-toggle over the
existing `sla-policies` backend endpoints (Story 10), no business-hours UI,
no backend changes — remains unbuilt. This is a documentation-only
finding from the reconciliation pass; no attempt was made to implement
Story 31 here, since doing so is out of scope for a reconciliation pass.

## Known pre-existing test limitation

`apps/api`'s e2e suite has one long-standing, environment-specific failure —
`sla-business-hours-target-computation.e2e-spec.ts`'s "computes same-day,
business-hours-aware targets under a fully open calendar" — caused by
`BusinessHoursException` rows accumulated across many repeated e2e runs
against a long-lived local Postgres volume, not by any implemented story's
code. A clean re-seed (`docker compose down -v` then re-migrate/re-seed)
resolves it; not done automatically since it would also discard local
fixture data.
