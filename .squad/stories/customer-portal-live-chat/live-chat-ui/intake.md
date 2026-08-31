> **Source:** autonomous Next-Story Recon, per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Customer Portal Live Chat
- **Feature slug:** `customer-portal-live-chat`

## Description

```text
Story 77 implemented the complete backend for Live Chat — ChannelMessage
persistence, POST/GET /tickets/:id/messages (agent) and POST/GET
/portal/tickets/:id/messages (customer), Socket.IO ticket:{id} room
authorization for both audiences, and channel.message.created — but its
own plan scoped the story to apps/api only (see that story's own "Files
expected to change": zero frontend files). No UI on either apps/web or
apps/portal ever called these endpoints or subscribed to that event. A
fresh Next-Story Recon across the whole repository found this the
single highest-confidence next increment: fully unblocked (no external
provider decision, unlike Communication/Channels' other four ChannelTypes
or the Integrations domain), architecturally minimal (pure frontend,
reusing an already-tested backend contract verbatim), and directly
closes the gap between "backend exists" and "feature is actually usable."
Selected.
```

## Acceptance criteria

```text
- Agent Workspace's ticket detail page (apps/web) shows a Live Chat card:
  loads history via GET /tickets/:id/messages, sends via POST
  /tickets/:id/messages, and reflects new messages via the existing
  channel.message.created realtime event without a full refetch.
- Customer Portal's ticket detail page (apps/portal) shows the
  corresponding chat UI against POST/GET /portal/tickets/:id/messages,
  kept live by this app's first realtime subscription
  (usePortalTicketRealtime), joining the same ticket:{id} room Story 77
  already authorizes a customer-audience Portal JWT to join.
- A message the sender's own socket echoes back (Story 77 broadcasts to
  the whole room, sender included) never renders twice - proven by
  mergeChannelMessage's id-based dedup on both the send-mutation's own
  onSuccess and the realtime handler.
- An event for a different ticket than the one currently open is ignored
  on both apps.
- Sender identity is distinguished correctly: a customer's message always
  renders as the customer's own (ownership-scoped, exactly one Contact
  per ticket); an agent's own OUTBOUND message renders as "You" and a
  colleague's as their name (apps/web only - a Portal contact has no
  access to the agent user list, so apps/portal labels every OUTBOUND
  message generically as "Agent").
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `customer-portal-live-chat` (Story 77, the
  complete backend/realtime contract this story implements the frontend
  half of, unchanged), `realtime-socketio-foundation` (Story 20, the
  `ticket:{id}` room/gateway both apps' realtime hooks join),
  `customer-portal-authentication-foundation` (Story 52, the Portal JWT
  `usePortalTicketRealtime` and the portal API client reuse unchanged),
  `agent-workspace-ticket-internal-notes` (Story 50, `TicketChatCard`'s
  sibling card in the same `TicketDetailView`, whose realtime-invalidate
  pattern this story's hooks sit alongside without changing).

## Out of scope

```text
Any apps/api change (Story 77 is the fixed backend contract); message
attachments; anonymous/public chat; typing indicators; read receipts;
message editing/deletion/reactions/search; AI-generated replies;
email/SMS/WhatsApp integrations or any other ChannelType producer;
replay-history-on-join; a shared cross-app UI package for the two chat
cards (each app keeps its own, matching this codebase's existing
independent-per-app-re-declaration convention for ticket-scoped DTOs).
```
