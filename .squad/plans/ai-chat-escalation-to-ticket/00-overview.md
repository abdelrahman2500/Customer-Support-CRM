# ai-chat-escalation-to-ticket — plan overview

Entry point for the **ai-chat-escalation-to-ticket** feature. Stories
execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 85 | [85-story-ai-chat-escalation-to-ticket.md](./85-story-ai-chat-escalation-to-ticket.md) | AI Chat — Escalate to a Human Ticket | — | `ai-portal-chatbot` Story 80 (`ChatSession`/`ChatMessage`, `AiChatService`), `customer-portal-ticket-submission-tracking` Story 53 (`TicketsService.createTicketForContact`, `PortalTicketsService`), `customer-portal-live-chat` Story 77 (`ChannelMessage`/`ChannelMessagesService`/`TicketChannelService`) |

## Dependency notes

- Selected via a fresh, whole-repository Recon after Story 84 (`CLAUDE.md`
  §2/§8). Closes a real, explicitly-disclosed non-goal from Story 80's own
  plan: *"Agent visibility: explicitly none. `chat-session:{id}` rejects
  `audience: "agent"` sockets outright; no `apps/web` route or component is
  touched by this story."* Today a portal customer who exhausts the AI
  chatbot's usefulness has no way to reach a human agent from that
  conversation — the only paths to an agent are the entirely separate
  "submit a ticket" form (Story 53, no context carried over) or ticket-scoped
  live chat (Story 77/78, which requires a ticket to already exist). This
  story is the missing bridge between the two, and directly serves the
  Full CRM Vision's "AI-assisted agent tooling" + "customer self-service
  portal" pairing named in `CLAUDE.md`'s Mission.
- **Reuses existing machinery end-to-end, invents nothing structurally
  new**: `TicketsService.createTicketForContact` (Story 53) creates the
  ticket exactly the way a normal portal-submitted ticket is created — no
  special-casing, so the escalated ticket automatically gets SLA targets,
  appears in the unassigned queue, and flows through every other existing
  ticketing mechanism identically. `ChannelMessagesService`/
  `TicketChannelService` (Story 77) persist the pre-escalation transcript
  as ordinary `ChannelMessage` rows against the new ticket, so it renders
  in the *already-built* `TicketChatCard` message thread on
  `apps/web`'s ticket detail page with zero new agent-facing UI surface —
  only a small, existing-component label fix (see the story's own Design
  decisions) is needed to attribute the assistant's turns correctly.
- **New `ChannelType.AI_CHAT` enum value**, not a reuse of `LIVE_CHAT`:
  the transcript being replayed did not happen on this ticket's own live
  chat channel — mislabeling it `LIVE_CHAT` would be factually wrong data,
  not just a display nit (`docs/architecture/06-communication-and-
  realtime.md` already names AI Services/chatbot work as `ai-processing`
  queue territory, structurally distinct from the `channels` schema's five
  named channel types — this is the sixth, and the first with no external
  provider at all, so no provider-decision blocker applies).
- **`ChatSession.escalatedTicketId` lives in the `ai` schema**, pointing at
  `ticketing.tickets` — mirrors `AiPromptLog.ticketId`'s own existing
  cross-schema-FK precedent (Story 76) exactly, including the
  cross-schema-FK style already used by `ChatSession.branchId`/
  `contactId` (Story 80's own migration references `identity.branches`
  and `customers.contacts` from the `ai` schema).
- **No new NestJS module and no new cross-module import edge.**
  `PortalModule` already imports both `TicketsModule` (exports
  `TicketsService`/`TicketChannelService`) and `AiModule` (exports
  `AiChatService`) — the orchestration (read the chat transcript, create a
  ticket, replay the transcript as `ChannelMessage`s, mark the session
  escalated) is added as one new method on the already-existing
  `PortalTicketsService`, which already injects `TicketsService` and
  `TicketChannelService` for exactly this kind of composition (Story
  53/77's own precedent). The reverse direction is deliberately avoided:
  `AiModule` cannot import `TicketsModule` (that module already imports
  `AiModule`, so the reverse edge would be circular) — this is exactly why
  the orchestration lives in `PortalModule`, not in `AiChatService`
  itself.
- Communication/Channels' four *provider-backed* channels (email,
  WhatsApp, SMS, web-form), Integrations, and pgvector/embedding-based KB
  semantic search all remain blocked on an unresolved external-provider
  decision (unchanged from prior Recon cycles — see
  `knowledge-base-article-search`'s own plan notes). This story has no
  dependency on any of them.
