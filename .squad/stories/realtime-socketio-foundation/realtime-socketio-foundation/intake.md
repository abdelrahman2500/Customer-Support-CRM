> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

- Folder: `.squad/stories/realtime-socketio-foundation/realtime-socketio-foundation/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Realtime / Socket.IO Foundation

- **Feature slug (folder under `plans/`):** `realtime-socketio-foundation`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** ``

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Realtime / Socket.IO Foundation
```

---

## Description

```text
Establish the backend realtime foundation for the Customer Support CRM using the Socket.IO architecture already specified by the project architecture documents.

The repository currently has no Socket.IO/WebSocket gateway implementation. Redis is already present in the platform and is used by the existing background-job infrastructure. The architecture explicitly identifies Socket.IO as the realtime transport and defines realtime responsibilities around authenticated connections, room-based communication, and live updates.

This story is intended to establish the minimum production-oriented realtime transport foundation only.

The story must first verify the exact realtime requirements already defined in the repository architecture and existing authentication/authorization implementation before proposing implementation details.

The realtime layer should integrate with the existing NestJS modular-monolith architecture and existing EventEmitter2 domain-event infrastructure rather than introducing a parallel event system.

The story should establish a secure authenticated Socket.IO connection and the architecture-defined room/subscription model, with appropriate tenant/branch/user authorization boundaries.

Where the architecture defines domain events as the source of realtime updates, the realtime layer should consume the existing domain events rather than modifying existing domain emitters unnecessarily.

The implementation must remain narrowly scoped to realtime transport infrastructure. It must not become a notification-delivery implementation, communication-channel implementation, customer-portal implementation, agent-workspace implementation, or workflow engine.

The planner must inspect the architecture documents and current repository implementation to determine the exact gateway structure, authentication handshake, room model, authorization rules, event contracts, Redis requirements, testing strategy, and scope boundaries. Do not invent requirements where the repository does not provide sufficient evidence.

Story 19 is complete and committed as:
36d12c4 feat: implement Ticket Escalation Notification Reaction

The current domain event graph has no emitted event without at least one consumer. Therefore this story must not be justified as a response to a dead-end domain event. Its justification is the explicitly documented realtime architecture and its role as shared infrastructure for future live ticket updates and in-app notification delivery.

The planner must determine whether this foundation is sufficiently specified to be a bounded story. If a product/design decision is genuinely required before implementation, the plan must stop and identify that decision rather than inventing one.
```

---

## Acceptance criteria

```text
- [ ] A dedicated NestJS realtime/Socket.IO module or gateway structure is established according to the repository's existing architecture conventions.

- [ ] Socket.IO authentication uses the project's existing authentication primitives and does not introduce a parallel JWT/authentication implementation.

- [ ] Unauthenticated or invalid socket connections are rejected according to the project's security model.

- [ ] Authenticated socket connections establish the user/tenant/branch context required by the architecture without bypassing tenant isolation.

- [ ] The room/subscription model implemented by the story matches the room model explicitly defined by the architecture.

- [ ] Room access is authorization-aware and cannot allow a user to subscribe to another tenant/branch's data.

- [ ] Realtime communication integrates with the existing EventEmitter2/domain-event architecture where the architecture requires domain events to drive realtime updates.

- [ ] Existing domain event emitters are not unnecessarily modified merely to support realtime delivery.

- [ ] The implementation does not directly read another module's Prisma-owned models to construct realtime messages when an existing domain event already provides the required contract.

- [ ] The implementation does not introduce notification recipient resolution, notification preferences, template rendering, email, SMS, WhatsApp, live-chat delivery, or provider integrations.

- [ ] The implementation does not introduce a new BullMQ notification queue or modify apps/worker unless the architecture proves that it is strictly required for the realtime foundation.

- [ ] Redis/Socket.IO adapter integration is included only if the repository architecture and deployment model require it; existing Redis infrastructure must not be duplicated unnecessarily.

- [ ] No new domain event is invented solely for the realtime layer unless the architecture demonstrates that an existing event contract is insufficient.

- [ ] Realtime errors and disconnects are handled without leaking authentication, tenant, or internal infrastructure details to clients.

- [ ] Unit tests cover the security-critical realtime behavior defined by the implementation.

- [ ] Integration/e2e tests prove the important realtime path against the repository's real authentication/event infrastructure where practical.

- [ ] Existing API unit tests and e2e tests remain unaffected.

- [ ] Existing Story 17, Story 18, and Story 19 behavior remains unchanged.

- [ ] No changes are made to notification behavior merely to prove the realtime foundation.

- [ ] No customer portal UI or agent workspace UI is implemented as part of this story unless a minimal client-side change is proven necessary to test the transport and is explicitly included in the final plan.

- [ ] No database migration is introduced unless the architecture and implementation prove that persistent realtime-specific state is actually required.

- [ ] The full existing workspace typecheck, lint, build, and test suites continue to pass.

- [ ] The working tree contains no unrelated changes after implementation.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| None                           |            |

---

## Dependencies

- **Blocked by / related ids:** None — Story 19 (`ticket-escalation-notification-reaction`) is completed and committed; no tracker id is currently linked.

- **Depends on code areas or other stories:**

  - Story 01 — Technology Stack / architecture decisions
  - Story 02 — Monorepo and environment scaffolding
  - Story 03 — Identity & Access
  - Story 04 — Automated Test Suite and CI infrastructure
  - Story 05 — verified project foundation / infrastructure
  - Existing `TenantContext`
  - Existing authentication and authorization guards/services
  - Existing `EventEmitter2` domain-event infrastructure
  - Existing Redis infrastructure
  - Existing ticket domain events from Ticketing
  - Existing Notifications domain from Stories 18–19

---

## Extra notes (optional)

- The repository currently has no implemented Socket.IO/WebSocket gateway.

- The architecture already identifies Socket.IO as the realtime transport, making this candidate more strongly specified than the currently unstarted Channels, Portal, or AutomationRule areas.

- Story 18 and Story 19 intentionally implemented notification reactions only as durable `NotificationLog` records. Real notification delivery remains future work.

- A future in-app notification story may consume this realtime foundation, but this story must not implement that notification-delivery workflow.

- The agent workspace in `apps/web` is still a documented placeholder. Do not turn this story into an agent-workspace UI story.

- The planner must verify the current repository rather than trusting these notes blindly.

---

## Technical hints (optional)

- APIs, screens, services already discussed:

  - NestJS
  - Socket.IO
  - EventEmitter2
  - JWT authentication
  - TenantContext
  - existing AuthGuard / PermissionsGuard
  - Redis
  - existing domain events
  - future in-app realtime notifications

- Repos/roots: `.`

- Primary language: `typescript`

- Existing architecture documents to inspect:

  - `docs/architecture/01-technology-stack.md`
  - `docs/architecture/02-repository-structure.md`
  - `docs/architecture/03-domain-boundaries.md`
  - `docs/architecture/05-security-and-authentication.md`
  - `docs/architecture/06-communication-and-realtime.md`
  - `docs/architecture/07-sla-automation-and-ai.md`
  - `docs/architecture/08-customer-portal.md`
  - `docs/architecture/09-api-design.md`
  - `docs/architecture/10-data-model.md`
  - `docs/architecture/11-testing-strategy.md`
  - `docs/architecture/12-risks-tradeoffs-and-scope.md`

---

## Out of scope

- Notification recipient resolution
- Notification preferences
- Notification template rendering/localization
- Email delivery
- SMS delivery
- WhatsApp delivery
- Live-chat/channel implementation
- External communication providers
- Full notification delivery pipeline
- Notification BullMQ queue
- `apps/worker` notification processing
- Customer Portal implementation
- Customer Portal authentication flow
- Agent workspace/dashboard implementation
- Frontend ticket UI
- Frontend notification UI
- Knowledge Base
- AI Services
- Reporting & Analytics
- Administration features beyond existing infrastructure
- Integrations
- `AutomationRule` / workflow engine
- Ticket mutation logic
- SLA calculation/escalation logic
- Changes to Story 17 escalation behavior
- Changes to Story 18 SLA at-risk notification behavior
- Changes to Story 19 ticket escalation notification behavior
- New database tables or persistent realtime state unless proven necessary by the architecture
- New domain events solely for realtime convenience
- Direct Prisma access to Ticketing-owned data from the realtime layer when the required information is already available through domain events
- Any unrelated refactoring
