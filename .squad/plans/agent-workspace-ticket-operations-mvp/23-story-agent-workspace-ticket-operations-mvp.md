# Story 23 — Agent Workspace: Ticket Operations MVP

## Prerequisites

- `project-foundation` Story 02 completed: `apps/web` Next.js/next-intl/Tailwind scaffolding, the JWT-cookie login→`/auth/me` wiring, and the two placeholder routes this story replaces (`apps/web/src/app/[locale]/(auth)/login/page.tsx`, `apps/web/src/app/[locale]/(agent)/dashboard/page.tsx`) — both carry their own doc comments naming "a future story" as the owner of the real screens. This is that story.
- `customer-management` Story 06, `ticketing` Stories 07–09, `sla-policy-foundation` Stories 10–13 completed: `TicketsController`/`TicketsService`, `CustomersController`/`CustomersService`, `UsersController`/`IdentityService`, `SlaTargetsController`/`SlaTargetsService`. None of these is modified except the two mechanical `TicketsService`/`TicketsController` extensions named in Design item 2.
- `realtime-socketio-foundation` Story 20 completed: `RealtimeGateway`, `RealtimeModule`, `RedisIoAdapter`, the `ticket:{id}` room and its existing authorization rule (`RealtimeGateway.authorizeRoom`, ticket-branch match via Prisma lookup), and `TicketRealtimeListener` relaying `TICKET_UPDATED_EVENT`/`TICKET_ESCALATED_EVENT` into `ticket:{id}`. None of this is modified except the CORS extension to `RedisIoAdapter.createIOServer` (Design item 6) — the gateway's authorization rule itself is untouched.
- The intake this plan was generated from (`.squad/stories/agent-workspace-ticket-operations-mvp/agent-workspace-ticket-operations-mvp/intake.md`) records the human-approved product decisions for this MVP: the exact screen set (Login → Ticket List → Ticket Detail), the exact ticket-list fields, the exact ticket-detail contents, the exact set of agent actions, the realtime behavior, the CORS decision (env-configured origins, `http://localhost:3000` for local dev), and an extensive out-of-scope list. This plan does not revisit any of those decisions.

---

## Story Goal

Give authenticated agents a real, working browser workspace over the already-complete ticketing/SLA/realtime backend: sign in for real, see a filterable/sortable list of their branch's tickets, open a ticket's full detail (customer, SLA, history/timeline), change its status/priority/category/assignment through the existing API, and see the open ticket update live via the existing `ticket:{id}` Socket.IO room. This is deliberately an MVP — it consumes existing contracts, with only two small, mechanical, additive backend extensions (Design items 2–3) and one infrastructure addition Story 20 itself named as a prerequisite (CORS, Design item 6).

**Not in scope** (per the intake's explicit "Out of scope" list, reaffirmed here after repository reconciliation): ticket/customer creation or onboarding UI; full-text search; list pagination; Customer Portal or customer-facing authentication; a second JWT/session system; a new authorization/permission model or new grants for the seeded `Agent` role; Agent Presence (`agent:{id}:presence`, online/away/offline, heartbeat, persistence); any NotificationService, recipient resolution, preferences, Notification Center, read/unread state, templates, external channel, or notifications queue — the `branch:{id}:notifications` room (Story 22) is not consumed by this story; Knowledge Base, AI, Reporting, Administration, Integrations, AutomationRule; CASL per-record ticket visibility; `Category` lookup-table redesign; SLA/escalation/`NotificationLog` redesign; attachment/object-storage work; a new realtime transport, room type, or gateway authorization rule; unassignment-to-`null`; production CORS origin values.

---

## Context — Read These Files First

1. `apps/web/src/app/[locale]/(auth)/login/page.tsx` and `apps/web/src/app/[locale]/(agent)/dashboard/page.tsx` (read in full) — the two Story 02 placeholders this story replaces, each with an explicit "a future story" comment. `apps/web/src/lib/api.ts` (5 lines) — `getApiBaseUrl()` and `ACCESS_TOKEN_COOKIE`, reused unmodified.
2. `apps/api/src/modules/tickets/tickets.controller.ts` (44 lines) and `tickets.service.ts` (whole file) — `TicketsController` exposes `POST /tickets` (out of scope), `GET /tickets` (`listTickets()`, currently **zero parameters**, hard-coded `orderBy: { createdAt: "asc" }`, `where: { branchId }` only), `GET /tickets/:id`, `PATCH /tickets/:id` (`UpdateTicketDto`: `subject?`, `category?`, `priority?`, `status?`, `departmentId?`, `assignedToUserId?` — **all four "Ticket Actions" the intake requires are already supported, zero backend change needed for them**), `GET /tickets/:id/history`. `TicketSummary` (lines 11–20) and `toTicketSummary()` **omit `createdAt`/`updatedAt`** even though the Prisma `Ticket` model has both (`schema.prisma` lines 256–283) — Design item 1 closes this gap.
3. `apps/api/prisma/schema.prisma` lines 256–283 (`Ticket` model) — confirms `createdAt`/`updatedAt` columns and a direct `slaTarget SlaTicketTarget?` relation already exist on `Ticket`, unused by any current controller response.
4. `apps/api/src/modules/sla-policies/sla-targets.controller.ts` (27 lines) / `sla-targets.service.ts` (whole file) — `GET /tickets/:id/sla-target` returns `{ id, ticketId, slaPolicyId, responseTargetAt, resolutionTargetAt }` or throws `NotFoundException` when no `SlaTicketTarget` row exists (no policy matched). No "at risk"/"breached" boolean is returned anywhere — only raw target timestamps. Reused unmodified for Ticket Detail (Design item 4 covers the List view's own, separate need).
5. `apps/api/src/modules/customers/customers.controller.ts` (39 lines) — `GET /customers`, `GET /customers/:id` (returns contacts too). `apps/api/src/modules/identity/users.controller.ts` (55 lines) — `GET /identity/users` (`listUsers()`, `user:read`). Both reused unmodified to resolve customer/assigned-agent display names client-side.
6. `apps/api/prisma/seed.ts` — `ROLE_GRANTS = { SuperAdmin: PERMISSION_CATALOG, Agent: [] }` (line ~39–42). The seeded `Agent` role has zero permissions today; only the seeded `SuperAdmin` can exercise any ticket/customer/user/SLA endpoint. This is pre-existing and out of this story's control — every existing e2e suite already authenticates as the seeded `SuperAdmin`. Design item 5 and Task 6 handle this by never assuming success client-side.
7. `apps/api/src/realtime/realtime.gateway.ts` (whole file) — `authorizeRoom`'s `ticket:{id}` rule (a Prisma lookup matching `claims.branchId`), unmodified. `apps/api/src/realtime/ticket-realtime.listener.ts` (39 lines) — relays `TICKET_UPDATED_EVENT`/`TICKET_ESCALATED_EVENT` into `ticket:{id}`, unmodified, the exact two events Ticket Detail subscribes to.
8. `apps/api/src/realtime/redis-io.adapter.ts` (55 lines) — `createIOServer(port, options?: ServerOptions)` already overrides and forwards an options object to `super.createIOServer(...)` before attaching the Redis adapter; this is the existing extension point Design item 6 uses for Socket.IO CORS, rather than inventing a new one.
9. `apps/api/src/main.ts` (47 lines) — no `app.enableCors()` call exists anywhere; `apps/api/src/common/config/env.validation.ts` (Zod `envSchema`, 27 lines) has no CORS/origin variable. Design item 6 adds both, following the existing `z.string()`-with-`.optional()` convention already used for `S3_ENDPOINT` etc.
10. `apps/web/package.json` — `@tanstack/react-query` and `zustand` are already dependencies, currently unused anywhere in `apps/web/src` (confirmed by grep). No `components.json`/Radix/`class-variance-authority` exists — `shadcn/ui` is not yet initialized (Task 1).
11. `apps/web/tailwind.config.ts` and `apps/web/messages/{en,ar}.json` — the existing RTL logical-property convention (`ms-*`/`me-*`/`ps-*`/`pe-*`, documented in the Tailwind config's own comment) and the existing i18n message-file shape, both preserved and extended, not replaced.
12. `packages/shared/src/auth.ts` — `AuthenticatedUser` (`id`, `email`, `fullName`, `branchId`, `departmentId`, `roles: string[]`), already returned by `GET /auth/me` and already used by the Story 02 dashboard placeholder. Reused unmodified; `roles` is available client-side if the UI needs to reason about what an agent can attempt (Design item 5 keeps this optional, not load-bearing).

---

## Design (resolved during this planning pass)

1. **Expose `createdAt`/`updatedAt` on `TicketSummary`.** Both columns already exist on the Prisma `Ticket` model (Context item 3); `TicketSummary`/`toTicketSummary()` (Context item 2) simply never mapped them. Adding them is additive to an existing interface — no existing caller's shape is narrowed or changed, only widened. This is the only change needed to satisfy the intake's "Created At"/"Updated At" list columns and "sort by Created At/Updated At" criteria.
2. **Add optional filter/sort query parameters to `GET /tickets`; do not add search or pagination.** Direct inspection (`grep -rn "@Query(" apps/api/src`) found **zero** existing query-parameter usage anywhere in `apps/api/src` — no list endpoint in this codebase takes any parameter today. Filtering by `status`/`priority`/`category`/`assignedToUserId` and sorting by `createdAt`/`updatedAt` are mechanical, same-response-shape extensions: they reuse fields and enum types (`TicketStatus`, `TicketPriority`) `UpdateTicketDto` already validates, add a plain equality `where` clause and a swappable `orderBy`, and return the exact same `TicketSummary[]` shape — no new envelope, no new business rule. Full-text search and pagination are **not** added: search has no existing index/strategy anywhere in this schema (no `tsvector`, no query capability to extend), and pagination has no existing response-envelope precedent anywhere in this repository to extend mechanically — inventing either here would mean inventing a first-of-its-kind API contract, which the intake's own "Out of scope" explicitly defers. A new `ListTicketsQueryDto` (class-validator, mirroring `UpdateTicketDto`'s existing convention) validates the four filter params plus `sortBy`/`sortDir`.
3. **Include each ticket's `slaTarget` relation in the list response; leave the dedicated per-ticket SLA endpoint untouched.** `Ticket.slaTarget` (Context item 3) is a direct, already-existing 1:1 relation — adding `include: { slaTarget: true }` to the existing `prisma.ticket.findMany` call in `listTickets()` requires no new query, no new table, no new business logic. `SlaTargetSummary`'s shape (Context item 4) is reused for the embedded value; when no `SlaTicketTarget` row exists, the field is simply `null` (mirroring the dedicated endpoint's `NotFoundException` semantics, but as an absent value rather than an HTTP error, since a list row must not fail the whole list). `SlaTargetsController`/`SlaTargetsService` are not modified — Ticket Detail keeps calling them directly (Context item 4).
4. **"SLA status" is derived client-side from the existing target timestamps, not from a new backend field.** No backend endpoint returns an "at risk"/"breached" label anywhere (Context item 4) — only `responseTargetAt`/`resolutionTargetAt`. The frontend computes "remaining time" as `targetAt - now` and shows "breached" once `now > targetAt`; the SLA module's own internal "at risk" warning threshold (Story 15/17's `sla-timers` job) is not reproduced or approximated client-side — this story surfaces only what the existing data already expresses (a target timestamp and whether it has passed), not a new business threshold.
5. **The frontend never assumes an action will succeed.** The seeded `Agent` role currently has no granted permissions (Context item 6) — only the seeded `SuperAdmin` can exercise these endpoints today. Every mutating action (`PATCH /tickets/:id`) is attempted against the real API and its real response is trusted: a `403`/`404` is surfaced as an inline error using the same pattern the existing login page already uses for a failed `POST /auth/login` (Context item 1), not hidden, not pre-empted by a client-side permission model. `AuthenticatedUser.roles` (Context item 12) is available but not required to gate the UI — this story does not build a new permission-aware rendering system, matching the intake's "no new authorization model" boundary.
6. **CORS: environment-configured allowed origins, added at the two existing, narrowest extension points.** `apps/api/src/common/config/env.validation.ts` gets one new optional variable, `CORS_ORIGINS` (comma-separated, `z.string().optional()`, matching the existing `S3_ENDPOINT`-style optional-string convention, Context item 9) — parsed in `main.ts` into a string array (empty/undefined → no origins allowed, matching today's actual behavior of no CORS support at all, so an unconfigured environment fails closed, not open). `main.ts` calls `app.enableCors({ origin: parsedOrigins, credentials: true })` (Context item 9) — `credentials: true` matches the login flow's existing `credentials: "include"` fetch (Context item 1), needed for the refresh-token cookie. `RedisIoAdapter.createIOServer` (Context item 8) is extended to merge the same parsed origins into the `options.cors` it already forwards to `super.createIOServer(...)` — no new adapter, no new gateway decorator option, no change to `RealtimeGateway.authorizeRoom`. Local development value: `CORS_ORIGINS=http://localhost:3000` (per the intake). No production origin is hard-coded; an unset `CORS_ORIGINS` in any environment (including today's) continues to reject cross-origin requests, so this is a pure opt-in addition.
7. **`shadcn/ui` is initialized as part of this story, not treated as pre-existing.** Context item 10 confirms it is not yet set up. Initializing it (`components.json`, `lib/utils.ts`, the small set of primitives this MVP needs: button, table, badge, input, select, and a dialog/sheet for the detail-view action forms) is scaffolding work explicitly named by the intake's approved technology list, not an invented alternative stack.
8. **Realtime scope is exactly `ticket:{id}`, nothing else.** Ticket Detail joins `ticket:{id}` (Story 20's existing room/authorization, Context item 7) on mount and listens for `ticket.updated`/`ticket.escalated`, invalidating the relevant TanStack Query cache entries on receipt (re-fetching rather than trusting the socket payload as the sole source of truth, the same "re-fetch by id" caution the backend's own listeners already use). The Ticket List does **not** join any realtime room in this story — polling/re-fetch-on-navigation is sufficient for an MVP list, and joining N ticket rooms for a whole list page is not named by the intake. `branch:{id}:notifications` (Story 22) is not joined anywhere in this story (per intake §9/§15).
9. **Display-name resolution is a client-side join over already-existing list endpoints, not a new backend contract.** `GET /customers` and `GET /identity/users` (Context item 5) are fetched once per session (TanStack Query, long stale time) and joined client-side against `customerId`/`assignedToUserId` — no new "expand" or "include names" backend parameter is added to `GET /tickets`, keeping Design item 2's extension minimal and additive.

---

## Implementation Tasks

### 1 — Backend: expose `createdAt`/`updatedAt`

File: `apps/api/src/modules/tickets/tickets.service.ts`

- Add `createdAt: Date; updatedAt: Date;` to `TicketSummary` and to `toTicketSummary()`'s parameter type and return mapping.
- No controller signature change — `GET /tickets`/`GET /tickets/:id`/`PATCH /tickets/:id`'s response bodies simply widen.

### 2 — Backend: `ListTicketsQueryDto` and `listTickets()` filter/sort

New file: `apps/api/src/modules/tickets/dto/list-tickets-query.dto.ts` — `status?: TicketStatus`, `priority?: TicketPriority`, `category?: string`, `assignedToUserId?: string` (UUID), `sortBy?: "createdAt" | "updatedAt"` (default `"createdAt"`), `sortDir?: "asc" | "desc"` (default `"asc"`, preserving today's behavior when the query is empty) — validated with the same `class-validator` decorators `UpdateTicketDto` already uses.

File: `apps/api/src/modules/tickets/tickets.service.ts` — `listTickets(query: ListTicketsQueryDto)` builds `where: { branchId, ...(status/priority/category/assignedToUserId conditionally) }` and `orderBy: { [sortBy]: sortDir }`, plus `include: { slaTarget: true }` (Design item 3); maps `slaTarget` into the response alongside `toTicketSummary(...)`.

File: `apps/api/src/modules/tickets/tickets.controller.ts` — `list(@Query() query: ListTicketsQueryDto)`.

No pagination, no search parameter is added (Design item 2).

### 3 — Backend: CORS configuration

File: `apps/api/src/common/config/env.validation.ts` — add `CORS_ORIGINS: z.string().optional()`.

File: `apps/api/src/main.ts` — parse `CORS_ORIGINS` into `string[]` (split on `,`, trim, filter empty; `undefined` → `[]`); call `app.enableCors({ origin: parsedOrigins, credentials: true })` before `app.listen(...)`.

File: `apps/api/src/realtime/redis-io.adapter.ts` — `createIOServer` merges the same parsed origins into `options.cors` before calling `super.createIOServer(port, { ...options, cors: { origin: parsedOrigins, credentials: true } })`; read via the already-injected `ConfigService` (Context item 8 already has `this.app.get(ConfigService<EnvConfig, true>)` inside `connectToRedis()` — reuse the same accessor).

File: `.env.example` (root) — document `CORS_ORIGINS` with the local-dev value from the intake, `http://localhost:3000`.

### 4 — Frontend: `shadcn/ui` initialization

`apps/web`: add `components.json`, `src/lib/utils.ts` (`cn()` helper), and the primitives this MVP's Tasks 5–7 need (button, table, badge, input, select, dialog/sheet, form). Tailwind config extended only as `shadcn/ui`'s own init generates (design tokens), preserving the existing RTL logical-property convention (Context item 11) in any new component markup.

### 5 — Frontend: real sign-in screen

Replace `apps/web/src/app/[locale]/(auth)/login/page.tsx`: same `/auth/login` request and cookie-setting behavior as today (Context item 1), rebuilt with `shadcn/ui` form primitives, loading state on submit, and the existing failure path (today's `setError("Login failed")`) surfaced through a proper inline alert component instead of a bare `<p>`.

### 6 — Frontend: workspace shell + auth guard

New authenticated layout (e.g. `apps/web/src/app/[locale]/(agent)/layout.tsx`): calls the same SSR `GET /auth/me` pattern the Story 02 dashboard already uses (Context item 1) to redirect an unauthenticated visitor to `login`; renders a minimal nav (workspace name, sign-out). Sign-out clears the access-token cookie and redirects to `login`.

### 7 — Frontend: Ticket List

New route replacing the dashboard placeholder content (e.g. `apps/web/src/app/[locale]/(agent)/tickets/page.tsx`, with `dashboard` becoming a redirect to it, or the list becoming the dashboard route directly — resolved at implementation time as a routing detail, not a product decision).

- TanStack Query `useQuery` against `GET /tickets` with the current filter/sort state as query params (Task 2).
- Two supporting queries, long `staleTime`: `GET /customers` and `GET /identity/users`, joined client-side for display names (Design item 9).
- Columns: Ticket ID, Subject, Customer (resolved name, fallback to id), Status, Priority, Category, Assigned Agent (resolved name, fallback to "Unassigned"), SLA status/remaining time (derived per Design item 4 from the embedded `slaTarget`, "No SLA target" when null), Created At, Updated At (both now present per Task 1).
- Filter controls: Status/Priority/Category/Assigned Agent selects, mapped to Task 2's query params.
- Sort controls: Created At / Updated At, ascending/descending.
- Explicit Loading (skeleton or spinner), Empty ("no tickets match"), and Error (retry) states.
- Row click navigates to Ticket Detail.

### 8 — Frontend: Ticket Detail

New route (e.g. `apps/web/src/app/[locale]/(agent)/tickets/[id]/page.tsx`).

- `useQuery` against `GET /tickets/:id`, `GET /tickets/:id/history`, and `GET /tickets/:id/sla-target` (the last tolerating a `404` as "no SLA target," not an error state, per Context item 4's own contract).
- Customer/assigned-agent name resolution reuses Task 7's `GET /customers`/`GET /identity/users` queries (same cache).
- History/timeline rendered from `TicketHistoryEntrySummary[]` (`eventType`, `actorUserId`, `snapshot`, `createdAt`) in existing chronological (`asc`) order.
- Action controls — Status, Priority, Category, Assignment — each calling `PATCH /tickets/:id` (`useMutation`), invalidating the detail (and list) query on success; a `4xx` response renders an inline error (Design item 5) rather than being retried or silently swallowed.
- On mount: connect `socket.io-client` (already a dependency via Story 20's own e2e usage pattern — add it to `apps/web`'s own dependencies if not already present there) to the API's base origin, `emit("join", { room: \`ticket:${id}\` })`, listen for `ticket.updated`/`ticket.escalated`, and on receipt invalidate this page's queries (Design item 8). Disconnect on unmount.

### 9 — i18n

Extend `apps/web/messages/en.json` and `messages/ar.json` with the new screens' strings (list columns, filter/sort labels, action labels, state messages), preserving the existing `common` namespace shape and adding new namespaces as needed (e.g. `tickets`).

### 10 — Tests

- Backend unit tests: `tickets.service.spec.ts` extended for the new filter/sort/`slaTarget`-include behavior and the `createdAt`/`updatedAt` mapping; a small unit test for the CORS origin-parsing helper in `main.ts` (extracted as a pure function for testability, following this codebase's existing "small pure helper, easily unit-tested" convention, e.g. `sla-transition-evaluator.ts` in `apps/worker`).
- Backend e2e: extend `apps/api/test/tickets.e2e-spec.ts` with filter/sort assertions against `GET /tickets`; a new small e2e check that a request with an `Origin` header matching `CORS_ORIGINS` receives the expected `Access-Control-Allow-Origin` response header.
- Frontend tests: component/unit tests for the Ticket List (filter/sort state → query params; loading/empty/error rendering) and Ticket Detail (action mutation success/error rendering; realtime cache-invalidation on a simulated socket event), using `apps/web`'s existing `vitest run --passWithNoTests` setup (first real tests added under this script).

---

## Edge Cases & Failure Modes

- **A ticket has no matching SLA policy** (`SlaTicketTarget` row absent): list row shows "No SLA target"; detail view's SLA section shows the same, from the existing `404` on `GET /tickets/:id/sla-target` — not an error banner.
- **An authenticated agent lacks permission for an action** (e.g. any non-`SuperAdmin` seed identity, per Context item 6): the relevant `PATCH /tickets/:id` call returns its real backend status; the UI shows an inline error and does not optimistically apply the change.
- **`GET /tickets` called with an unrecognized `sortBy`/invalid enum value for `status`/`priority`**: rejected by `ListTicketsQueryDto`'s validators with the existing global `ValidationPipe`'s `400`, the same behavior every other DTO in this codebase already has — no new error-handling convention.
- **Socket connection drops while Ticket Detail is open**: the existing "empty room / no delivery" Socket.IO semantics apply (Story 20/22 precedent) — the page simply stops receiving live updates until the user navigates back or the socket reconnects; no new reconnection/backoff architecture is introduced beyond `socket.io-client`'s own defaults.
- **`CORS_ORIGINS` unset in any environment**: `app.enableCors({ origin: [] , ... })` continues to reject all cross-origin requests — identical to today's actual behavior (no CORS configured at all) — so this story cannot regress an environment that never opts in.
- **A ticket's `assignedToUserId`/`departmentId` no longer resolves to an in-scope user/department** (e.g. removed from the branch after assignment): existing `TicketsService.updateTicket`'s `requireUserInScope`/`requireDepartmentInScope` guards (unmodified) already reject such a change with a `404` — surfaced the same as any other rejected action (Design item 5).

---

## Test Plan

1. **Unit — `apps/api/src/modules/tickets/tickets.service.spec.ts`** (extended): `listTickets()` applies each filter independently and in combination; sorts by `createdAt`/`updatedAt` in both directions; includes `slaTarget` (present and `null` cases); `toTicketSummary()` includes `createdAt`/`updatedAt`.
2. **Unit — CORS origin parsing** (new, wherever the parsing helper is extracted to): empty/undefined → `[]`; comma-separated with whitespace → trimmed array; single origin → single-element array.
3. **Integration — `apps/api/test/tickets.e2e-spec.ts`** (extended): `GET /tickets?status=...&priority=...&sortBy=updatedAt&sortDir=desc` against real fixtures; a request with an `Origin: http://localhost:3000` header (with `CORS_ORIGINS=http://localhost:3000` set for the test run) receives a matching `Access-Control-Allow-Origin` header.
4. **Frontend — Ticket List / Ticket Detail component tests** (new, `apps/web`): filter/sort UI drives the expected query string; loading/empty/error states render correctly from mocked query states; a status/priority/category/assignment action mutation's success and error paths both render correctly; a simulated `ticket.updated` socket event triggers a query invalidation.
5. **Regression:** full existing `apps/api` unit + e2e suite (in particular `realtime-socketio-foundation.e2e-spec.ts`, `in-app-notification-delivery.e2e-spec.ts`, `sla-at-risk-notification.e2e-spec.ts`, `ticket-escalation-notification.e2e-spec.ts`, and every `ticketing`/`sla-policies` suite) must remain unaffected — none of their fixtures rely on `GET /tickets` taking zero parameters, and `TicketSummary` gaining two additive fields does not break any existing assertion that checks specific keys rather than exact object equality (verify this directly against each existing assertion during implementation; if any test asserts exact object equality against `TicketSummary`, it must be updated to include the two new fields, not have the new fields removed).
6. **Regression:** full existing `apps/web` suite (`vitest run --passWithNoTests` — currently zero tests) and `apps/worker` suite, unaffected.

---

## Migration / Rollback

No Prisma schema or migration change — every backend change in this story reads existing columns/relations (`createdAt`, `updatedAt`, `slaTarget`) that already exist in the database; nothing new is persisted. Rollback is a plain code revert of the `apps/api` and `apps/web` changes; no data cleanup of any kind is needed.

---

## Verification Steps

1. **Backend builds:** `pnpm --filter @crm/api typecheck`, `lint`, `build`.
2. **Frontend builds:** `pnpm --filter @crm/web typecheck`, `lint`, `build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` at the repository root.
4. **Unit tests:** `pnpm --filter @crm/api test`, `pnpm --filter @crm/web test`.
5. **Live infra:** `docker compose up -d postgres redis` (temporary `5433` fallback if needed, revert immediately after, per prior stories' convention).
6. **Integration tests:** `pnpm --filter @crm/api test:e2e`, including the new CORS/filter/sort assertions.
7. **Manual smoke check:** run `apps/api` (`pnpm --filter @crm/api dev`, with `CORS_ORIGINS=http://localhost:3000` set) and `apps/web` (`pnpm --filter @crm/web dev`) together; sign in as the seed admin, confirm the ticket list loads with working filters/sort, open a ticket, confirm history/SLA render, perform a status change, confirm it persists and the list reflects it, confirm a `ticket.updated` emitted via the existing `EventEmitter2`/API path live-updates an open detail view.
8. **Hygiene:** `git status`; confirm no unrelated files changed; confirm `RealtimeGateway.authorizeRoom`, `TicketRealtimeListener`, `BranchNotificationRealtimeListener`, `NotificationLog` and its listeners, and every SLA-policies file have empty diffs.
9. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] Real sign-in screen replaces the Story 02 placeholder; unauthenticated visitors are redirected away from the workspace.
- [ ] Ticket List shows all ten specified fields per ticket, including the newly-exposed `createdAt`/`updatedAt` and the derived SLA status/remaining time.
- [ ] Ticket List supports filtering by Status/Priority/Category/Assigned Agent and sorting by Created At/Updated At against the real API; no search or pagination UI/endpoint is added.
- [ ] Ticket List has explicit Loading, Empty, and Error states.
- [ ] Ticket Detail shows ticket info, customer info, status/priority/category, assigned agent, SLA information (or its explicit absence), and the full history/timeline.
- [ ] An agent can change Status, Priority, Category, and Assignment from Ticket Detail via the existing `PATCH /tickets/:id`; a backend authorization rejection is surfaced as an error, never bypassed or hidden.
- [ ] Ticket Detail joins the existing `ticket:{id}` room and reflects `ticket.updated`/`ticket.escalated` without a new realtime transport, room type, or gateway authorization change.
- [ ] The API accepts configured cross-origin REST and Socket.IO requests via `CORS_ORIGINS`; no production origin is hard-coded; an unset `CORS_ORIGINS` continues to reject all cross-origin requests.
- [ ] No `agent:{id}:presence`, `NotificationService`, `branch:{id}:notifications` consumption, ticket/customer creation UI, CASL, or any other out-of-scope item listed above is introduced.
- [ ] `RealtimeGateway.authorizeRoom`, `TicketRealtimeListener`, `BranchNotificationRealtimeListener`, `NotificationLog` and its listeners, and every SLA-policies file remain byte-for-byte unchanged.
- [ ] Unit, integration, and new frontend tests exist and pass per the Test Plan above.
- [ ] Full existing lint/typecheck/build/test suite (every prior story through Story 22) still passes with no regressions.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
