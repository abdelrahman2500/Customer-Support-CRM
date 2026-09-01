# customer-portal-notification-delivery — plan overview

Entry point for the **customer-portal-notification-delivery** feature.
Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 86 | [86-story-customer-portal-notification-delivery.md](./86-story-customer-portal-notification-delivery.md) | Customer Portal — Live Notification Delivery | — | `realtime-socketio-foundation` Story 20/71 (`RealtimeGateway`), `in-app-notification-delivery` Story 22/24 (`BranchNotificationRealtimeListener`/`NotificationToaster` pattern), `customer-portal-live-chat` Story 77/78 (`ChannelMessage`/`TicketRealtimeListener`'s customer-visible `ticket:{id}` broadcast) |

## Dependency notes

- Selected via a fresh, whole-repository Recon after Story 85 (`CLAUDE.md`
  §2/§8). Confirms the Recon lead flagged at the end of Story 85's own
  report: **"Notifications-domain recipient resolution for portal
  customers"** is a real, currently-total gap, not a false lead. Today
  `apps/portal` has *zero* notification surface of any kind — a customer
  learns about a new agent reply, a status change, or a resolution only by
  being on that exact ticket's detail page at the moment it happens
  (`usePortalTicketRealtime`, Story 78, joins `ticket:{id}` only from that
  one page). Anywhere else in the portal (the ticket list, Knowledge Base,
  the AI chat widget, or simply not having the tab open) the customer gets
  nothing. This directly contradicts `docs/architecture/06-communication-
  and-realtime.md`'s own "Notification architecture" section, which
  describes `NotificationService` as the sole recipient-resolving,
  channel-agnostic notifier for the whole product — not an agent-only
  mechanism — and is a real, documented gap in the Full CRM Vision's named
  "customer self-service portal" pairing (`CLAUDE.md`'s Mission).
- The second lead from Story 85's report — re-checking Communication/
  Channels/Integrations for a newly-unblocked external-provider decision —
  was re-verified during this Recon and remains unchanged:
  `docs/architecture/12-risks-tradeoffs-and-scope.md`'s trade-off table
  still names "Build vs. buy channels" as an open buy-decision ("Revisit
  when: Not expected to be revisited" for the general policy, and no
  concrete email/WhatsApp/SMS provider has been chosen anywhere in the
  repository — confirmed via `docs/architecture/09-integrations.md`, which
  still describes the ERP adapter's own protocol as "open until a future
  story names them" and gives no provider for any channel). Communication/
  Channels' four provider-backed channels and the whole Integrations
  domain remain ineligible for selection per `CLAUDE.md` §2. `pgvector`
  KB semantic search remains transitively blocked on choosing an embedding
  provider (Anthropic Claude, the resolved AI vendor, has no embeddings
  endpoint) — unchanged from `knowledge-base-article-search`'s own plan
  notes.
- **Dependency correctness**: builds on infrastructure that is already
  fully in place and untouched by this story — `RealtimeGateway`'s room/
  claims/authorization machinery (Stories 20/71/77/80), the
  `TicketRealtimeListener`/`BranchNotificationRealtimeListener` "relay an
  already-existing domain event into a room" pattern (Stories 20/22), and
  the `useBranchNotifications`/`BranchNotifications`/`NotificationToaster`/
  `notifications-store` client-side shape (Story 24). Nothing new is
  invented structurally; this story is the portal-side mirror of a pattern
  this codebase has already built and proven twice (agent branch-wide
  notifications, and the customer-visible half of `ticket:{id}` for live
  chat).
- **Architectural coherence**: `Ticketing`'s `ticket.updated` event is
  already fully readable by a ticket's own customer via `GET
  /portal/tickets/:id` (confirmed by `TicketRealtimeListener`'s own doc
  comment: "its `TicketSummary` payload is already fully readable by the
  ticket's own customer... routing it to the whole room introduces no new
  exposure"). `channel.message.created` is likewise already fully
  readable via `GET /portal/tickets/:id/messages` (Story 77). This story
  widens *reach* of two already-customer-visible events into a new,
  always-joined room — it does not expose anything new. No cross-module
  import edge changes: the new listener lives in `apps/api/src/realtime/`
  exactly like `BranchNotificationRealtimeListener`, subscribing to
  existing `Ticketing`/`Communication-Channels` events already emitted
  today.
- **Recipient resolution, scoped correctly**: Customer Portal ticket
  visibility is already Customer-scoped, not Contact-scoped (every
  `PortalTicketsService` method resolves `customerId` from the
  authenticated Contact and passes that to `TicketsService`/
  `TicketChannelService` — any Contact belonging to the same `Customer`
  can already see the same tickets). The new room is therefore
  `customer:{customerId}:notifications`, not `contact:{contactId}:...` —
  this is the correct recipient-resolution boundary given how portal data
  access already works, not an invented one.
- **Product value**: closes the single largest observable gap in the
  Customer Portal domain relative to `docs/architecture/03-domain-
  boundaries.md`'s "Notifications" row and the Full CRM Vision's customer
  self-service portal. A portal customer no longer has to keep a specific
  ticket page open to learn their ticket was answered or resolved.
- **Non-goals carried forward deliberately** (mirrors Story 20/22/24's own
  "first iteration" scoping, not a shortcut): no `NotificationLog`
  persistence for portal events, no notification history/read endpoint,
  no per-event preference toggle, no custom notification template, and no
  email/SMS/WhatsApp delivery. Every one of those was *also* absent from
  the agent-side feature's first iteration (Stories 20/22/24) and was
  added incrementally only in later, separate Stories (36, 58, 61, 63).
  This story is that same first increment, for the portal.
