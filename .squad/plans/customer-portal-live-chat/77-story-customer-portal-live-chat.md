# Story 77 — Customer Portal Live Chat

## Goal

Implement Live Chat for **authenticated Customer Portal users only** (the
repository owner's own explicit decision, resolving the Architecture
Decision Recon's one open question) — two-way messaging on an existing
ticket between its owning customer and any agent viewing that ticket,
real-time in both directions, using `ChannelMessage` (the `channels`
schema `docs/architecture/06-communication-and-realtime.md` names but this
repository never implemented) as the first real consumer.

## Non-goals

- Anonymous/public-widget Live Chat — explicitly out of scope for V1 per
  the resolved decision; no visitor/session mechanism is introduced.
- Any other `ChannelType` (`EMAIL`/`WHATSAPP`/`SMS`/`WEB_FORM`) getting a
  real producer — the enum values exist (matching the architecture's own
  fixed taxonomy, mirroring `AiFeature`'s precedent), only `LIVE_CHAT` is
  reachable.
- Starting a chat creates no new ticket — messaging happens on a ticket
  the customer already owns (submitted via the existing Story 53 flow or
  created by an agent), directly implied by the trust-boundary decision's
  own room-authorization mechanism (`ticket:{id}` + `findTicketInCustomerScope`).
- No new realtime room, gateway, namespace, or authorization primitive —
  reuses `RealtimeGateway`/`ticket:{id}` exactly.
- No message attachments.
- No "replay history on join" — message history is fetched via the new
  REST list endpoints; realtime only carries live deltas going forward
  (mirrors every existing realtime event in this codebase).
- `Ticket.externalRef` is not added — `LIVE_CHAT` has no external
  provider thread to correlate; deferred to whichever future channel
  (email/SMS/WhatsApp) actually needs it.

## Design decisions

1. **`channels` schema, `ChannelMessage` model** — `channelType`,
   `direction` (`INBOUND`/`OUTBOUND`), `senderContactId`/`senderUserId`
   (exactly one set, matching `direction` — an application-layer
   invariant, mirroring `Contact.email`'s own "app-layer invariant over a
   DB constraint" precedent), `body`, `externalThreadId` (nullable,
   unused by `LIVE_CHAT`). No `attachments` field yet.
2. **Module split mirrors Story 72/73's `AiModule`/`TicketAiService`
   precedent exactly**: `ChannelsModule`/`ChannelMessagesService` (owns
   `channels` schema, pure persistence, no ticket-authorization logic) vs.
   `TicketsModule`'s new `TicketChannelService` (composes
   `TicketsService.getTicket`/`getTicketForCustomer` for authorization
   with `ChannelMessagesService` for persistence) — `PortalTicketsService`
   calls `TicketChannelService`'s customer-scoped methods directly, the
   same way it already calls `TicketsService`'s own customer-scoped
   methods (Story 53's precedent).
3. **Realtime trust boundary — exactly the resolved Architecture Decision
   Recon**: `RealtimeGateway.handleConnection` accepts `audience:
   "customer"` alongside `"agent"` (same `JwtService`/secret, nothing new
   to authenticate against); `authorizeRoom`'s `ticket:(.+)$` case
   branches by audience — agent checks `ticket.branchId`, unchanged;
   customer resolves their own `customerId` via a `Contact` lookup
   (`RealtimeClaims` carries only the Contact id) and checks
   `ticket.customerId`, mirroring `findTicketInCustomerScope`'s exact
   two-step shape. `branch:{id}:notifications`/`agent:{id}:presence`
   become explicitly agent-only — neither was ever documented as
   customer-facing.
4. **Event-leakage closed, not merely noted** — the recon flagged that a
   customer joining `ticket:{id}` would otherwise receive
   `ticket.note-added`'s full internal note body verbatim (Story 50:
   agent-only), plus `ticket.escalated`/`ai.prompt_completed`'s internal
   SLA/AI-tooling state, neither ever exposed via the Portal's own REST
   surface. `RealtimeGateway` gains `emitToAgentsInRoom(room, event,
   payload)` — enumerates the room's sockets via Socket.IO's own
   `fetchSockets()` (the documented, Redis-adapter-safe way to read a
   room's members' `client.data` cluster-wide) and emits only to sockets
   whose stored `claims.audience === "agent"`. `TicketRealtimeListener`
   routes those three events through it; `ticket.updated` stays a plain
   whole-room broadcast (its `TicketSummary` payload is already
   fully readable by the ticket's own customer via `GET
   /portal/tickets/:id`, so no new exposure); the new
   `channel.message.created` also stays plain (the one event meant for
   both audiences).
5. **HTTP surface mirrors `notes`/AI-route precedent exactly**:
   `POST/GET /tickets/:id/messages` (agent, gated by
   `ticket:create`/`ticket:read` — the same permissions `notes` already
   uses) and `POST/GET /portal/tickets/:id/messages` (customer, gated by
   `@PortalRoute()` alone, no RBAC — Contacts have no role system, Story
   52's precedent). REST is the write path; the realtime event is the
   fan-out notification — mirrors this codebase's own established
   convention (every existing mutation goes through REST + a domain event
   + `TicketRealtimeListener`, never a socket-received mutation message).

## Files expected to change

- `apps/api/prisma/schema.prisma` — `channels` schema, `ChannelType`/
  `ChannelMessageDirection` enums, `ChannelMessage` model, relations on
  `Ticket`/`Contact`/`User`.
- `apps/api/prisma/migrations/<ts>_add_channel_messages/` — generated
  migration.
- `apps/api/src/modules/channels/` (new): `channel-messages.service.ts`
  (+ spec), `channel-messages.events.ts`, `channels.module.ts`.
- `apps/api/src/modules/tickets/`: new `ticket-channel.service.ts` (+
  spec), new `dto/create-channel-message.dto.ts`, `tickets.controller.ts`
  (new routes), `tickets.module.ts` (imports `ChannelsModule`, exports
  `TicketChannelService`).
- `apps/api/src/modules/portal/`: `portal-tickets.controller.ts`/
  `portal-tickets.service.ts` (+ spec) — new routes/methods.
- `apps/api/src/realtime/`: `realtime.gateway.ts` (+ spec) — audience
  acceptance, `authorizeRoom` customer branch, `emitToAgentsInRoom`;
  `ticket-realtime.listener.ts` (+ spec) — new handler, agent-only
  routing for the three internal events.
- `apps/api/test/tickets.e2e-spec.ts`, `portal-tickets.e2e-spec.ts`,
  `realtime-socketio-foundation.e2e-spec.ts` — new coverage, including the
  end-to-end leak-prevention proof (an agent receives `ticket.note-added`
  in a shared room; a customer sharing the same room never does).

## Acceptance criteria

- A customer-audience Portal JWT (Story 52's existing mechanism, no
  changes) can open a Socket.IO connection and join `ticket:{id}` only
  for a ticket their own `Customer` owns — denied for any other ticket,
  `branch:{id}:notifications`, and `agent:{id}:presence`.
- `channel.message.created` reaches both an agent and the ticket's own
  customer sharing `ticket:{id}`, proven against real Redis/Socket.IO.
- `ticket.note-added`/`ticket.escalated`/`ai.prompt_completed` reach an
  agent in `ticket:{id}` exactly as before, and are proven, against real
  Redis/Socket.IO, to never reach a customer sharing the same room.
- `POST/GET /tickets/:id/messages` (agent) and `POST/GET
  /portal/tickets/:id/messages` (customer) work end to end, preserving
  Story 68 department visibility (agent) and cross-customer 404 masking
  (customer) exactly like every existing ticket/portal-ticket route.
- Every pre-existing test suite remains green, unweakened; only the
  already-documented pre-existing e2e failures remain (see Verification
  plan for the exact, freshly-confirmed set at the time of this story).

## Verification plan

- Unit tests: `ChannelMessagesService`, `TicketChannelService`,
  `RealtimeGateway` (audience acceptance, customer room authorization,
  `emitToAgentsInRoom`), `TicketRealtimeListener` (agent-only vs.
  plain-broadcast routing per event) — all mirroring their nearest
  existing precedent's exact mocking patterns.
- e2e: `tickets.e2e-spec.ts`/`portal-tickets.e2e-spec.ts` REST coverage;
  `realtime-socketio-foundation.e2e-spec.ts` gains a `customer portal live
  chat` block exercising real Socket.IO connections for both audiences
  against real Redis, including the leak-prevention proof.
- Full workspace: `pnpm --filter @crm/api test`, `test:e2e`,
  `pnpm --filter @crm/web test`, `pnpm --filter @crm/portal test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build`.
