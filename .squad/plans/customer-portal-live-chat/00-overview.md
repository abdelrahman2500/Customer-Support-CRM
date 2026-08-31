# customer-portal-live-chat — plan overview

Entry point for the **customer-portal-live-chat** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                             | Tracker id | Depends on                                                                 |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | ------------------------------------------------------------------------------ |
| 77  | [77-story-customer-portal-live-chat.md](./77-story-customer-portal-live-chat.md) | Customer Portal Live Chat | —          | `realtime-socketio-foundation` Story 20 (gateway, `ticket:{id}`), `customer-portal-authentication-foundation` Story 52 (Portal JWT), `agent-workspace-ticket-internal-notes` Story 50 (`ticket.note-added`, the event this story must not leak) |
| 78  | [78-story-live-chat-ui.md](./78-story-live-chat-ui.md) | Live Chat UI (Agent Workspace + Customer Portal) | — | Story 77 (the complete backend/realtime contract this story builds the frontend for, unchanged) |

## Dependency notes

- New feature slug — first real `ChannelMessage`/`channels`-schema consumer, resolving the "Channels Foundation and Live Chat are mutually dependent, build together" finding from the preceding Architecture Decision Recon (a `channels`-schema-only story would have been inert scaffolding; a Live-Chat-only story would have nothing to persist messages into).
- Resolves the product decision made explicitly by the repository owner (not inferred): **V1 Live Chat is authenticated Customer Portal users only — anonymous visitors are out of scope.** This story does not revisit that decision.
- Directly implements the architecture recon's own resolved trust-boundary design: reuse `RealtimeGateway`, reuse the existing Portal JWT/`JwtService`, extend `authorizeRoom`'s `ticket:(.+)$` case by audience, mirror `TicketsService.findTicketInCustomerScope`'s exact resolution shape for the customer branch.
- Discovers and closes a real, story-introduced event-leakage gap: `ticket.note-added`/`ticket.escalated`/`ai.prompt_completed` carry internal-only content that must never reach a customer now sharing `ticket:{id}` with agents — see the story's own Design items for `RealtimeGateway.emitToAgentsInRoom`.
- Does not implement: anonymous/public Live Chat, Channels for any other channel type (email/SMS/WhatsApp/web-form — `ChannelType` enumerates them per the architecture's own fixed taxonomy, but only `LIVE_CHAT` has a producer), a new realtime room/gateway/namespace, message attachments, or a "replay history on join" mechanism (message history is retrieved via the existing REST list endpoints, not replayed over the socket).
