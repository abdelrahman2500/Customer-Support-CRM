# ai-ticket-assist-async-processing — plan overview

Entry point for the **ai-ticket-assist-async-processing** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                                             | Title                             | Tracker id | Depends on                                                                 |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------- | ------------------------------------------------------------------------------ |
| 76  | [76-story-ai-ticket-assist-async-processing.md](./76-story-ai-ticket-assist-async-processing.md) | AI Ticket-Assist Async Processing | —          | `ai-services-foundation` Story 72 (`@crm/ai`, `AiPromptLog`), `sla-timer-detection-foundation` Story 15 (cross-app hand-back queue precedent), `realtime-socketio-foundation` Story 20 (`ticket:{id}`, `TicketRealtimeListener`), Stories 73-75 (the endpoints being corrected) |
| 79  | [79-story-ai-ticket-assist-result-delivery.md](./79-story-ai-ticket-assist-result-delivery.md) | AI Ticket-Assist Result Delivery | — | Story 76 (fulfills its own explicitly-deferred "no polling/read-by-id endpoint" non-goal), `customer-portal-live-chat` Story 78 (direct structural precedent for the new frontend hook/API-client/card files) |

## Dependency notes

- New feature slug, separate from `ai-services-foundation` — this story corrects an already-shipped architectural deviation (Stories 73-75 calling the AI provider synchronously inside the HTTP request), it does not extend Story 72's own foundation scope.
- Resolves the exact tension Story 15's own plan first resolved for SLA detection: work that must run in `apps/worker` (BullMQ) needs to notify `apps/api`'s in-process `EventEmitter2`/realtime layer. The resolution is the same narrow, feature-specific BullMQ hand-back bridge Story 15 established — not a generic cross-process event bus, and not a second one invented for AI specifically beyond duplicating the same shape.
- The architecture-boundary refactor (`07f896a`, "extract shared provider package") is a hard prerequisite and is treated as already complete and authoritative — this plan does not reopen where `AnthropicAiProvider`/`NullAiProvider` live.
- Deliberately does not implement: chatbot/chat sessions, KB semantic search, any Channels/Live Chat/Web Forms/Email/SMS/WhatsApp/ERP work, a new realtime room, a polling/read-by-id endpoint, or any retry/backoff policy beyond BullMQ's own defaults.
- Story 79 is the direct fulfillment of Story 76's own deferred "polling/read-by-id endpoint" non-goal, once a real frontend consumer exists to justify it — see that story's own plan for the exact deferral text.
