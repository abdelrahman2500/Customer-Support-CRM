> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-ticket-operations-mvp/agent-workspace-ticket-operations-mvp/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Ticket Operations MVP

- **Feature slug (folder under `plans/`):** `agent-workspace-ticket-operations-mvp`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Agent Workspace — Ticket Operations MVP
```

---

## Description

```text
Provide the first real browser-based workspace for authenticated agents to work with the already-existing ticketing backend. This is an MVP: it consumes and exposes existing ticketing/SLA/realtime capabilities rather than introducing a new backend domain.

Both `apps/web` routes that exist today are explicit wiring proofs, not a finished product:
- `apps/web/src/app/[locale]/(auth)/login/page.tsx`: "Deliberately unstyled ... not the agent app's real sign-in screen (a future story owns that)."
- `apps/web/src/app/[locale]/(agent)/dashboard/page.tsx`: "Not a finished dashboard: a real agent workspace is a future story."

This story is that future story, scoped narrowly to:

Login -> Authenticated Agent -> Ticket Workspace (Ticket List, Ticket Detail)

The workspace is for authenticated agents only (existing `audience: "agent"` JWTs). It does not introduce customer-facing portal authentication, a second JWT/session system, a new authorization model, or CASL per-record ticket visibility (Story 07's deferral stands).

Ticket creation, customer creation/onboarding, Agent Presence, a Notification Center / NotificationService, external communication channels, Knowledge Base, AI, Reporting, Administration, Integrations, and AutomationRule are all explicitly out of scope.
```

---

## Acceptance criteria

```text
- An authenticated agent can sign in through a real (not placeholder) sign-in screen using the existing `/auth/login` + `/auth/me` contract.
- An unauthenticated visitor to any workspace route is redirected to sign in.
- The Ticket List displays, per ticket: Ticket ID, Subject, Customer, Status, Priority, Category, Assigned Agent, SLA status/remaining time (or "no SLA target" when none exists), Created At, Updated At.
- The Ticket List supports filtering by Status, Priority, Category, and Assigned Agent, and sorting by Created At and Updated At, via the ticketing API.
- Full-text search and pagination are explicitly NOT included in this story (see "Out of scope" — no existing backend capability for either; see also the planner's own repository-evidence findings).
- The Ticket List explicitly handles Loading, Empty-result, and Error states.
- Selecting a ticket opens a Ticket Detail view showing: ticket information, customer information, status, priority, category, assigned agent, SLA information (or its absence), and the ticket's history/timeline.
- From Ticket Detail, an agent can change Status, Priority, Category, and Assignment, using the existing `PATCH /tickets/:id` contract and existing backend authorization — the frontend does not assume every authenticated agent can perform every action; a backend authorization rejection is surfaced as an error, not hidden or worked around.
- Ticket Detail reflects the existing `ticket.updated`/`ticket.escalated` realtime events for the open ticket via the existing `ticket:{id}` Socket.IO room (Story 20), without a new realtime transport, room type, or gateway authorization rule.
- The API accepts cross-origin requests (REST and the Socket.IO handshake) from an environment-configured allowed-origin list; for local development the allowed origin is `http://localhost:3000`. No production origin is hard-coded.
- No customer portal authentication, second JWT/session system, or new authorization/permission model is introduced.
- No `agent:{id}:presence` publisher/consumer, online/away/offline semantics, heartbeat, or presence persistence is introduced.
- No NotificationService, recipient resolution, preferences, templates, read/unread state, notification queue, or external channel adapters are introduced. The `branch:{id}:notifications` room (Story 22) is not consumed by this story's UI.
- No ticket creation, customer creation, or customer onboarding UI is introduced.
- CASL per-record ticket visibility (Story 07's deferral) is not implemented.
- `Category` remains a plain string field — no lookup-table redesign.
- Existing SLA engine, escalation logic, ticket business rules, and `NotificationLog` are unmodified.
- Typecheck, lint, and existing test suites (backend and frontend) remain clean/passing; new backend and frontend behavior has test coverage.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `project-foundation` Story 02 (auth/i18n wiring, placeholder routes this story replaces); `customer-management` Story 06; `ticketing` Stories 07–09; `sla-policy-foundation` Stories 10–13; `realtime-socketio-foundation` Story 20.

- **Depends on code areas or other stories:**

  - `apps/api/src/modules/tickets/**` (`TicketsController`, `TicketsService`, `TicketSummary`, `UpdateTicketDto`) — existing CRUD, update, and history endpoints.
  - `apps/api/src/modules/sla-policies/sla-targets.controller.ts` / `sla-targets.service.ts` — existing per-ticket SLA target read endpoint.
  - `apps/api/src/modules/customers/**`, `apps/api/src/modules/identity/users.controller.ts` — existing customer and user read endpoints, used to resolve display names.
  - `apps/api/src/realtime/**` (`RealtimeGateway`, `TicketRealtimeListener`, `RedisIoAdapter`) — existing Socket.IO transport and `ticket:{id}` room, Story 20.
  - `apps/api/src/common/config/env.validation.ts`, `apps/api/src/main.ts` — env-driven configuration surface this story extends for CORS.
  - `apps/web/**` — existing Next.js/next-intl/Tailwind scaffolding, `@tanstack/react-query` and `zustand` (installed, currently unused).
  - Stories 02, 06, 07–09, 10–13, 17, 20 must remain compatible and must not be reimplemented.

## Extra notes (optional)

- This story was selected after a strict repository recon following Story 22 concluded "no uniquely determined Story 23 exists" on its own — every remaining backend domain required an unresolved product/business decision, and Agent Workspace's own scope (fields, interactions, boundaries) had not yet been specified by a human. This intake supplies that missing human specification; the planner should treat the Acceptance Criteria above as resolved product decisions, not as something to re-derive or second-guess.
- **Full-text search and list pagination are deferred, not silently dropped.** Direct repository inspection during reconciliation found zero existing precedent anywhere in `apps/api` for query-parameter-based search or pagination on any list endpoint (no `@Query()` usage exists in `apps/api/src` today), and `TicketsService.listTickets()` currently takes no parameters at all. Introducing either would mean inventing a first-of-its-kind API contract shape (a search index/strategy, or a paginated-response envelope) rather than mechanically extending an existing one — exactly the kind of invented architecture this workflow forbids without a human decision. Filtering (by Status/Priority/Category/Assigned Agent) and sorting (by Created At/Updated At) are included because they are mechanical, same-response-shape extensions of the existing `GET /tickets` endpoint using already-existing scalar fields — they do not require a new contract shape.
- The `Ticket` Prisma model already has `createdAt`/`updatedAt` columns and a direct `slaTarget SlaTicketTarget?` relation; `TicketSummary`/`toTicketSummary()` currently omit both. Exposing them is a mechanical extension (no new business logic), included in this story's backend scope.
- The seeded `Agent` role currently has zero granted permissions (`ROLE_GRANTS.Agent: []` in `apps/api/prisma/seed.ts`) — only `SuperAdmin` has any. This is pre-existing, unrelated to this story (every existing e2e suite already authenticates as the seeded SuperAdmin), and is handled by the acceptance criterion that the frontend must not assume every action succeeds and must surface backend authorization rejections — not by adding new permission grants.
- Story 20's own plan explicitly named the CORS/allowed-origins gap as the prerequisite "a future story integrating a real browser client (Customer Portal, Agent Workspace) must resolve ... first." This intake resolves the product side of that (environment-configured origins, `http://localhost:3000` for local dev, no hard-coded production value) so the planner can close it mechanically.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Frontend stack to use, already established in this repository: Next.js App Router, React, TypeScript, Tailwind, TanStack Query for server state, Zustand only where genuinely needed for client state, `next-intl` for i18n (existing `apps/web/messages/{en,ar}.json`, existing RTL logical-property convention documented in `apps/web/tailwind.config.ts`). `shadcn/ui` is not yet initialized in `apps/web` (no `components.json`, no Radix/`class-variance-authority` dependency) — initializing it is in scope as it is the human-approved UI toolkit, not an invented alternative.
- CORS: `apps/api/src/main.ts` currently has no `app.enableCors()` call, and `apps/api/src/realtime/redis-io.adapter.ts`'s `createIOServer(port, options)` override already receives a `ServerOptions` object it forwards to `super.createIOServer(...)` — the natural, existing extension point for adding a `cors` option to the Socket.IO server without inventing a new mechanism.
- Backend extensions to `TicketsService`/`TicketsController` should read query parameters the same way every other DTO-validated input in this codebase is validated (class-validator + a dedicated query DTO), matching `CreateTicketDto`/`UpdateTicketDto`'s existing conventions.

## Out of scope

- Ticket creation UI, Customer creation/onboarding UI.
- Full-text ticket search (no existing backend capability — flagged as a follow-up dependency, not built).
- List pagination (no existing backend contract/convention anywhere in this repository — flagged as a follow-up dependency, not built).
- Customer Portal, customer-facing authentication, a second JWT/session system.
- Agent Presence: `agent:{id}:presence`, online/away/offline semantics, heartbeat, presence persistence/broadcasting.
- NotificationService, notification recipient resolution, notification preferences, a Notification Center, notification read/unread state, notification templates/localization, email/SMS/WhatsApp or any other external channel, a notifications BullMQ queue. The `branch:{id}:notifications` room (Story 22) is not consumed by this story.
- Knowledge Base, AI Services, Reporting & Analytics, Administration UI, Integrations, ERP integration, AutomationRule.
- CASL per-record ticket visibility (Story 07's deferral stands).
- `Category` lookup-table redesign; SLA engine/escalation redesign; ticket escalation redesign; `NotificationLog` redesign.
- Attachment/object-storage work.
- A new realtime transport, room type, or `RealtimeGateway` authorization rule.
- A new authorization/permission model; new permission grants for the seeded `Agent` role.
- Unassignment-to-`null` (clearing `assignedToUserId`) — the existing `UpdateTicketDto`/`TicketsService.updateTicket` limitation from Story 07 is unchanged.
- Production CORS origin values — supplied later through deployment environment configuration, never hard-coded by this story.
