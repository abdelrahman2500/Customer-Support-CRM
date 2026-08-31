# ai-portal-chatbot — plan overview

Entry point for the **ai-portal-chatbot** feature. Stories execute in order
by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 80 | [80-story-ai-portal-chatbot.md](./80-story-ai-portal-chatbot.md) | AI Portal Chatbot (Foundation) | — | `ai-services-foundation` Story 72 (`AiProvider.chat`, `AiGatewayService`), `ai-ticket-assist-async-processing` Stories 76/79 (the async worker + realtime hand-back + result-polling pattern this story extends to a second feature), `customer-portal-authentication-foundation` Story 52 (portal Contact JWT auth), `realtime-socketio-foundation` Story 20 + `customer-portal-live-chat` Story 77 (the `audience: "customer"` realtime room precedent) |

## Dependency notes

- New feature slug, separate from `ai-services-foundation` and
  `ai-ticket-assist-async-processing` — this is a new AI-domain capability
  (chatbot sessions), not a correction or extension of the ticket-scoped AI
  work those two features already completed.
- Resolves a real tension between two architecture documents:
  `docs/architecture/02-system-architecture-overview.md`'s Boundary rule 2
  ("`apps/api` never blocks a request on slow external work... calling the
  AI provider... always enqueued to BullMQ") versus
  `docs/architecture/07-sla-automation-and-ai.md`'s "interactive chatbot
  turns use the asynchronous provider client through the API." This plan
  resolves the tension in favor of the queued path — see the story's own
  "Design decision" section for the full reasoning, anchored on
  `docs/architecture/06-communication-and-realtime.md` line 27 ("
  `ai-processing` for summaries, categorization, suggested replies, **and
  chatbot work** that need not block requests"), which is unambiguous and
  resolves the other two documents' more general/ambiguous language.
- Deliberately does not implement: Knowledge Base embeddings/semantic
  retrieval feeding chat context (chat calls `AiProvider.chat` with only
  the raw message — no KB-grounded retrieval), any agent-facing visibility
  into a chat session, streaming/token-by-token replies, multi-turn context
  windowing beyond what `AiProvider.chat` itself does, or any change to
  `AnthropicAiProvider`/`NullAiProvider`/`packages/ai`.
