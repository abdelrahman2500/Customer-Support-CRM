> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/customer-portal-notification-delivery/customer-portal-notification-delivery/intake.md`

---

## Feature

- **Feature name (display):** Notifications / Customer Portal
- **Feature slug (folder under `plans/`):** `customer-portal-notification-delivery`

## Title

```text
Story 86 — Customer Portal: Live Notification Delivery
```

## Description

```text
apps/portal has zero notification surface today. A customer only learns
about a new agent reply or a ticket status change by being on that exact
ticket's detail page at the moment it happens (usePortalTicketRealtime
joins ticket:{id} only from that one page, Story 78). This story adds a
second, independent realtime room, customer:{customerId}:notifications,
authorized for any Contact of the matching Customer (mirroring how portal
ticket visibility is already Customer-scoped, not Contact-scoped), and a
new CustomerNotificationRealtimeListener that relays two already
customer-visible events into it: ticket.updated (unconditionally) and
channel.message.created (only when agent-authored, i.e. senderUserId is
set). apps/portal joins this room once per session (mounted in the
authenticated layout) and shows a transient, dismissible toast for each
event, mirroring the Agent Workspace's own first notification iteration
(Stories 20/22/24) file-for-file.
```

## Acceptance criteria

```text
- [ ] RealtimeGateway.authorizeRoom recognizes
      customer:{customerId}:notifications, authorizing only a
      customer-audience socket whose own Contact.customerId matches, and
      rejecting any agent-audience socket outright.
- [ ] CustomerNotificationRealtimeListener relays ticket.updated
      unconditionally (using the event's own ticket.customerId) and
      channel.message.created only when message.senderUserId is set
      (resolving the ticket's customerId via one Prisma lookup, mirroring
      BranchNotificationRealtimeListener.onTicketEscalated's pattern),
      registered as a provider in RealtimeModule.
- [ ] apps/portal mounts a client that joins this room once per
      authenticated session (in (customer)/layout.tsx, alongside
      PortalHeader) and renders a transient, auto-dismissing,
      manually-dismissible toast per event with a "View ticket" link to
      /{locale}/tickets/{ticketId}.
- [ ] No change to ticket:{id}'s existing behavior,
      usePortalTicketRealtime, or TicketRealtimeListener.
- [ ] No NotificationLog write, no preferences toggle, no notification
      template, and no email/SMS/WhatsApp delivery introduced.
- [ ] New unit tests cover: the gateway's new room-authorization branch;
      the new listener's both event handlers (including the
      senderUserId filter, the ticket-not-found case, and
      catch-and-log-never-throw on a Prisma/socket failure); the portal
      store, hook, and toaster/mount components.
- [ ] Typecheck, lint, build, and the relevant test suites
      (apps/api unit, apps/portal unit) pass.
```

## Dependencies

- Story 20/71 — `realtime-socketio-foundation` /
  `realtime-agent-presence` (`RealtimeGateway`, `authorizeRoom`)
- Story 22/24 — `in-app-notification-delivery` (the relay-listener +
  toast-stack pattern this story mirrors for the portal)
- Story 77/78 — `customer-portal-live-chat` (`ChannelMessage`,
  `TicketRealtimeListener`, confirms both relayed events are already
  customer-visible via REST, so this story introduces no new exposure)

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Any `NotificationLog` persistence, read/history endpoint, preference
  toggle, or custom template for portal notifications.
- Any email/SMS/WhatsApp/push delivery — remains blocked on an unresolved
  external-provider decision (Communication/Channels, Integrations).
- Any change to `ticket:{id}`'s existing room, listener, or
  `usePortalTicketRealtime`.
- Any new room/event for `sla.at_risk`/`sla.breached`/`ticket.escalated`
  (agent-only signals with no customer-facing equivalent).
- Any notification-center/unread-badge UI beyond a transient toast stack.
