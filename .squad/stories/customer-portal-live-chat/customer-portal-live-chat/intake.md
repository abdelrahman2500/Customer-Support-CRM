> **Source:** autonomous Next-Story Recon + Architecture Decision Recon,
> per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Customer Portal Live Chat
- **Feature slug:** `customer-portal-live-chat`

## Description

```text
A dedicated Architecture Decision Recon investigated the highest-leverage
blocked decision from the prior Next-Story Recon: Live Chat's
customer-audience Socket.IO trust boundary and authenticated-vs-anonymous
scope. It found the authenticated-case architecture fully determined by
existing repository evidence (the Portal already issues real audience:
"customer" JWTs via the exact same JwtService/secret as agent tokens,
Story 23 already generalized Socket.IO CORS, and TicketsService already
has an exact customer-scoped room-authorization analogue in
findTicketInCustomerScope) but found the anonymous-visitor question
genuinely unresolvable from the repository alone. The repository owner
then made the explicit product decision: V1 Live Chat is authenticated
Customer Portal users only; anonymous visitors are out of scope. This
story implements that decision, using the repository's own existing SLA
cross-app-events precedent's sibling patterns (TicketAiService/AiModule's
module-split shape) as its template, and closes a real event-leakage gap
the recon separately flagged: internal-only ticket events must never
reach a customer newly authorized into ticket:{id}. Selected.
```

## Acceptance criteria

```text
- A customer-audience Portal JWT can open a Socket.IO connection and join
  ticket:{id} only for a ticket their own Customer owns - denied for any
  other ticket, branch:{id}:notifications, and agent:{id}:presence.
- channel.message.created reaches both an agent and the ticket's own
  customer sharing ticket:{id}, proven against real Redis/Socket.IO.
- ticket.note-added/ticket.escalated/ai.prompt_completed reach an agent in
  ticket:{id} exactly as before, and are proven, against real
  Redis/Socket.IO, to never reach a customer sharing the same room.
- POST/GET /tickets/:id/messages (agent) and POST/GET
  /portal/tickets/:id/messages (customer) work end to end, preserving
  Story 68 department visibility and cross-customer 404 masking exactly
  like every existing ticket/portal-ticket route.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `realtime-socketio-foundation` (Story 20,
  the gateway/`ticket:{id}` this story extends), `customer-portal-
  authentication-foundation` (Story 52, the Portal JWT mechanism reused
  unchanged), `agent-workspace-ticket-internal-notes` (Story 50, the
  `ticket.note-added` event this story must not leak to a customer).

## Out of scope

```text
Anonymous/public-widget Live Chat (explicitly decided out of scope for
V1); any ChannelType other than LIVE_CHAT getting a real producer;
ticket-creation-from-chat (messaging happens on an already-owned ticket
only); any new realtime room/gateway/namespace; message attachments;
replay-history-on-join (history via REST list endpoints only);
Ticket.externalRef (no external thread to correlate for LIVE_CHAT).
```
