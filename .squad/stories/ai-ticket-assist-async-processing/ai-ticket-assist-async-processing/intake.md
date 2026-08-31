> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** AI Ticket-Assist Async Processing
- **Feature slug:** `ai-ticket-assist-async-processing`

## Description

```text
A fresh recon after the "extract shared provider package" refactor (07f896a)
re-verified that Stories 73-75 still call AiGatewayService.summarize/
suggestReply/categorize synchronously inside the HTTP request path, which
docs/architecture/02-system-architecture-overview.md's Boundary rule 2
explicitly forbids ("apps/api never blocks a request on slow external
work... calling the AI provider... always enqueued to BullMQ and performed
by apps/worker"). docs/architecture/06-communication-and-realtime.md names
ai-processing for exactly this work. The prior architecture-boundary
refactor already resolved where the provider implementation lives
(packages/ai / @crm/ai, consumed by both apps/api and apps/worker); this
story only routes the three existing ticket-assist endpoints through a
real BullMQ queue, using the repository's own existing SLA cross-app
hand-back bridge (Story 15: SlaTimersProducer / SlaTimerProcessor /
SlaTimerEventsBridgeProcessor / TicketRealtimeListener) as the template.
No other candidate was safe: every other remaining V1 gap (Channels, Live
Chat, Web Forms, Chatbot, KB semantic search, SLA action-set redesign,
etc.) requires either an external vendor decision or a product/design
decision this session cannot make unilaterally. Selected.
```

## Acceptance criteria

```text
- No synchronous AI provider call remains in apps/api's request path for
  POST /tickets/:id/ai/{summarize,suggest-reply,categorize}.
- All three endpoints keep their existing method/path/ticket:read
  permission/Story 68 department-visibility enforcement, and now return
  { id: <AiPromptLog.id>, outcome: "PENDING" } immediately.
- Exactly one AiPromptLog row exists per submitted operation (created
  PENDING by apps/api, updated to its final outcome by apps/worker) -
  never two rows for the same operation.
- apps/worker's new ai-processing processor resolves the AiProvider only
  through @crm/ai / the existing AiProviderModule - no duplicated
  Anthropic SDK usage anywhere.
- A completed operation's outcome and latencyMs are persisted on the same
  row, and exactly one ticket:{id} realtime broadcast results, via the
  existing TicketRealtimeListener mechanism - no new room/gateway.
- No retry/backoff policy is invented beyond BullMQ's own defaults.
- Every pre-existing test suite remains green, unweakened; the 8
  documented pre-existing e2e failures remain the only failures.
```

## Dependencies

- **Blocked by / related ids:** `ai-services-foundation` (Story 72,
  `AiPromptLog`/`@crm/ai` foundation); the `07f896a` architecture-boundary
  refactor (`packages/ai` — a hard prerequisite, already complete);
  `sla-timer-detection-foundation` (Story 15, the cross-app hand-back
  pattern this story reuses verbatim); `realtime-socketio-foundation`
  (Story 20, `ticket:{id}`/`TicketRealtimeListener`); Stories 73-75 (the
  endpoints being corrected).

## Out of scope

```text
Chatbot/chat sessions (job/queue types scoped to SUMMARIZE/SUGGEST_REPLY/
CATEGORIZE only, not the full AiFeature enum's CHAT value); KB semantic
search/embeddings; Channels/Live Chat/Web Forms/Email/SMS/WhatsApp/ERP;
any new realtime room/gateway/namespace/authorization mechanism; a
polling/read-by-id endpoint; retry/backoff policy beyond BullMQ defaults;
reopening where AnthropicAiProvider/NullAiProvider live; fabricating a
real ANTHROPIC_API_KEY.
```
