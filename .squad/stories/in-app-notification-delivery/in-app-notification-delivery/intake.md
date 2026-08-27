> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/in-app-notification-delivery/in-app-notification-delivery/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** In-App Notification Delivery

- **Feature slug (folder under `plans/`):** `in-app-notification-delivery`

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

_(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)_

```text
In-App Notification Delivery
```

---

## Description

```text
Complete the first narrow end-to-end in-app notification delivery path for SLA-related events using the authenticated, branch-scoped Socket.IO realtime transport established by Story 20.

The existing SLA/event pipeline already detects SLA-at-risk and SLA-breach conditions, persists notification-related records, and produces ticket escalation events. Story 20 established the Socket.IO transport and the authorized branch notification room `branch:{id}:notifications`, but nothing currently publishes SLA notification events into that room.

This story should connect the existing notification-worthy events to the existing branch notification room so authorized agents connected to the same branch can receive the events in real time.

The approved product decision for this first iteration is explicitly:

Branch-wide, non-targeted in-app notification broadcast is acceptable.

Every authorized agent connected to their branch's `branch:{id}:notifications` room may receive every supported notification event for that branch.

This is intentionally a narrow delivery slice and must not become a generalized notification platform.

Reuse the existing realtime architecture, authorization model, EventEmitter2 event flow, event payloads, and NotificationLog persistence where appropriate. Do not invent a new notification routing architecture.

The intended value chain is:

SLA detection → SLA escalation → notification logging/domain events → Socket.IO branch notification room → connected branch agents
```

---

## Acceptance criteria

```text
- `SLA_AT_RISK_EVENT` is relayed to the appropriate `branch:{branchId}:notifications` Socket.IO room.

- `SLA_BREACHED_EVENT` is relayed to the appropriate `branch:{branchId}:notifications` Socket.IO room, either directly or through the existing escalation/event chain where that is the established architecture.

- `TICKET_ESCALATED_EVENT` is relayed to the appropriate `branch:{branchId}:notifications` Socket.IO room.

- The implementation reuses Story 20's existing Socket.IO transport and `branch:{id}:notifications` room rather than creating another realtime transport or room type.

- Notification delivery remains branch-scoped and authorization-aware using the existing Story 20 room authorization rules.

- A connected authorized agent in branch A can receive notification events for branch A.

- A connected authorized agent in branch A cannot receive notification events belonging to branch B.

- The notification relay does not require per-user recipient resolution.

- No recipient/user targeting is introduced in this story.

- No notification preference system is introduced in this story.

- No notification template or localization system is introduced in this story.

- No new email, SMS, WhatsApp, or other external channel delivery is introduced.

- No notifications BullMQ queue is introduced.

- No generalized `NotificationService`, notification routing framework, or channel abstraction is introduced.

- `NotificationLog` is not converted into a per-user inbox/read-state model.

- Existing `NotificationLog` persistence and existing SLA/ticket event behavior remain intact.

- Event payloads delivered over Socket.IO contain the minimum existing event information required by the current event contracts; do not invent a new generalized notification payload model unless the existing architecture requires a minimal transport envelope.

- The implementation must not change SLA detection, SLA escalation, ticket escalation, or existing domain-event semantics except where necessary to connect the already-existing events to realtime delivery.

- Unit tests cover the new notification relay behavior and branch scoping/authorization assumptions.

- E2E tests verify that a connected authorized agent receives the supported notification events through the branch notification room.

- E2E tests verify branch isolation: an agent authorized for one branch does not receive notification events for another branch.

- Existing Story 20 realtime tests continue to pass.

- Existing SLA, ticket escalation, notification logging, worker, and workspace test suites continue to pass without unrelated regressions.

- Typecheck, lint, and build remain clean.

- The implementation remains limited to the approved branch-wide broadcast first iteration; true per-recipient targeting and notification preferences are explicitly deferred to a later story.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** Story 20 — Realtime / Socket.IO Foundation; Story 18/19 — existing SLA notification logging/reaction flow; Story 17 — ticket escalation event flow.

- **Depends on code areas or other stories:**

  - Story 20's `RealtimeModule`, `RealtimeGateway`, Socket.IO adapter, and existing `branch:{id}:notifications` room authorization.
  - Existing `SLA_AT_RISK_EVENT` and `SLA_BREACHED_EVENT` payloads and emitters.
  - Existing `TICKET_ESCALATED_EVENT` flow.
  - Existing `NotificationLog` persistence.
  - Existing EventEmitter2 event architecture.
  - Stories 17–20 must remain compatible and must not be reimplemented.

## Extra notes (optional)

- This story was selected after the post-Story-21 repository recon identified no other uniquely determined next story and confirmed that Story 20 already established the realtime transport required for this notification path.

- The branch-wide broadcast decision is intentional for the first iteration. Do not reinterpret the architecture's future `NotificationService` requirements as mandatory scope for this story.

- Future work may introduce per-user recipient resolution, notification preferences, templates/localization, queue-based delivery, delivery/read state, and external channels. Those are explicitly outside this story.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

- Existing realtime code is under `apps/api/src/realtime/`.

- Existing SLA event definitions are under the SLA modules and already carry `branchId` where applicable.

- `TICKET_ESCALATED_EVENT` may require the same minimal ticket lookup/branch resolution pattern already used by the existing ticket realtime listener.

- Reuse the existing `TicketRealtimeListener` / realtime event relay pattern where technically appropriate rather than creating a parallel mechanism.

- The existing notification room is `branch:{id}:notifications`.

- The planner should verify the exact current event names, payload shapes, event emitters, and realtime authorization code directly from the repository before defining implementation tasks.

## Out of scope

- Per-user recipient resolution or targeting.
- Notification preferences.
- Notification templates.
- Localization of notification messages.
- General-purpose `NotificationService`.
- Notification routing/orchestration framework.
- Notification BullMQ queue or worker.
- Delivery retries/status tracking beyond existing behavior.
- Read/unread notification state.
- Per-user notification inbox persistence.
- Email delivery.
- SMS delivery.
- WhatsApp delivery.
- Other external communication channels.
- Channels domain implementation.
- Customer Portal notification delivery.
- Live chat.
- Agent presence.
- Changes to SLA detection or SLA calculation logic.
- Changes to ticket escalation business rules.
- Changes to the existing `NotificationLog` data model unless a minimal, strictly necessary compatibility change is proven by the repository.
- New Socket.IO room types or a second realtime transport.
- Reopening or implementing `AutomationRule`.
- Broad frontend notification UI/inbox work; this story establishes the backend realtime delivery path only.
