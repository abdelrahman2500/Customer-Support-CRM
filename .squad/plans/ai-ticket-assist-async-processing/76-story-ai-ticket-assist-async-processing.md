# Story 76 — AI Ticket-Assist Async Processing

## Goal

Correct the real architecture deviation in already-shipped Stories 73-75:
`TicketAiService` currently calls `AiGatewayService.summarize/suggestReply/
categorize` synchronously, `await`ed inside the HTTP request. This violates
`docs/architecture/02-system-architecture-overview.md`'s Boundary rule 2
("`apps/api` never blocks a request on slow external work... calling the AI
provider... always enqueued to BullMQ and performed by `apps/worker`") and
`docs/architecture/06-communication-and-realtime.md`'s explicit naming of
`ai-processing` for exactly this work. Route all three endpoints through a
real `ai-processing` BullMQ queue, mirroring the existing SLA cross-app
hand-back pattern (Story 15) exactly.

## Non-goals

- No chatbot/chat session work — the job payload/queue types are scoped to
  `SUMMARIZE`/`SUGGEST_REPLY`/`CATEGORIZE` only, not the full `AiFeature`
  enum's `CHAT` value.
- No KB semantic search/embeddings.
- No Channels/Live Chat/Web Forms/Email/SMS/WhatsApp/ERP work.
- No new realtime room, gateway, namespace, or authorization mechanism —
  reuses `ticket:{id}` and `TicketRealtimeListener` exactly as they exist.
- No polling/read-by-id endpoint — no frontend consumer exists for any of
  Stories 73-75 today, and the realtime event already covers the live-UX
  case; the durable `AiPromptLog` row remains inspectable through existing
  patterns if ever needed.
- No retry/backoff policy beyond BullMQ's own defaults — no existing queue
  in this repository configures one (`registerQueue` calls are bare
  `{ name }` everywhere), so none is invented here.
- Does not reopen where `AnthropicAiProvider`/`NullAiProvider` live —
  `07f896a`'s `packages/ai` boundary is authoritative and unchanged.
- Does not fabricate a real `ANTHROPIC_API_KEY` — `NullAiProvider` remains
  what actually runs in this environment.

## Design decisions

1. **Queue shape mirrors Story 15's SLA hand-back bridge exactly**: an
   API-side producer (`AiProcessingProducer`, alongside
   `HealthCheckProducer`/`SlaTimersProducer` in `apps/api/src/queues/`)
   enqueues onto `ai-processing`; a worker-side processor
   (`AiProcessingProcessor`) consumes it, does the real work, and enqueues
   onto a second, dedicated hand-back queue (`ai-processing-events`); an
   API-side bridge processor (`AiProcessingEventsBridgeProcessor`)
   translates that job into exactly one `EventEmitter2.emit(...)` call —
   no business logic of its own, mirrors `SlaTimerEventsBridgeProcessor`'s
   own "no notification/escalation business behavior... only relays"
   restraint precisely.
2. **Queue names/payload types are deliberately duplicated** between
   `apps/api` and `apps/worker`, per this repository's own established,
   doc-commented convention (Story 14) — no new shared-constants
   mechanism is introduced.
3. **`AiPromptLog` lifecycle**: add one new `AiOutcome` value, `PENDING`
   (the created-but-not-yet-resolved state), and make `latencyMs`
   nullable (`Int?` — genuinely unknown until the worker finishes).
   `model`/`promptRef` stay non-null: `promptRef` is computable from the
   ticket text alone (unchanged hash function); `model` is written as the
   placeholder `"pending"` at creation and overwritten with the real
   resolved value (a real Anthropic model name, or `"disabled"`) once the
   worker completes — the API cannot know in advance which provider the
   *worker's own* independent `AI_PROVIDER` resolution will select.
4. **Exactly one `AiPromptLog` row per operation**: created once, by
   `AiGatewayService.createPendingLog` (API, pre-enqueue); updated once,
   directly by `AiProcessingProcessor` via the worker's own `PrismaService`
   (mirrors `SlaTimerProcessor` updating `SlaTicketTarget` directly, never
   through an API-side service call). `AiGatewayService` no longer calls
   any `AiProvider` method at all — its only remaining responsibility is
   creating that first row. This is the minimum necessary change to stop
   provider calls from the request path (not a full deletion — the class,
   its Prisma-access role, and its `promptRef()` helper are preserved).
5. **`AiModule` (`apps/api`) no longer constructs an `AiProvider`.**
   Nothing in `apps/api` calls the provider anymore, so keeping
   `AnthropicAiProvider`/`NullAiProvider` construction there would be dead
   code and an architecture footgun (an easy place for a future change to
   accidentally reintroduce a synchronous call). Provider
   construction/selection now lives only in `apps/worker`'s already-built
   `AiProviderModule`. `AI_PROVIDER`/`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`
   are removed from `apps/api`'s own constants/env validation as a direct,
   mechanical consequence — they were added by Story 72 specifically to
   support the capability this story removes from `apps/api`, and nothing
   else in `apps/api` reads them. `apps/api` keeps its `@crm/ai` dependency
   only for the still-used `AiTicketInput` type.
6. **HTTP response contract**: all three endpoints return
   `{ id: <AiPromptLog.id>, outcome: "PENDING" }` immediately (still the
   same HTTP method/path/permission). The durable `AiPromptLog.id` — never
   a raw BullMQ job id — is the primary handle, per the prior architecture
   recon's own resolution (no repository precedent anywhere exposes a raw
   job id to an HTTP caller).
7. **Authorization**: `TicketAiService` still calls
   `TicketsService.getTicket`/`getTicketNotes` (branch scope + Story 68
   department visibility) synchronously, before creating the log row or
   enqueueing anything — unchanged from Stories 73-75. The job payload
   (`{ aiPromptLogId, ticketId, branchId, feature, subject, body }`)
   carries only already-authorized data; the worker never re-derives or
   re-checks access.
8. **Realtime**: `TicketRealtimeListener` gains one more `@OnEvent`
   handler for a new `ai.prompt_completed` domain event
   (`apps/api/src/modules/ai/ai.events.ts`, mirroring
   `sla-detection.events.ts`'s placement/shape), relayed into `ticket:{id}`
   exactly like `ticket.updated`/`ticket.escalated`/`ticket.note-added`.
   Payload is minimal: `{ aiPromptLogId, ticketId, feature, outcome }` —
   never the full AI result text, per the durable record staying the
   source of truth.

## Files expected to change

- `apps/api/prisma/schema.prisma` — `AiOutcome` gains `PENDING`;
  `AiPromptLog.latencyMs` becomes nullable.
- `apps/api/prisma/migrations/<ts>_add_ai_prompt_log_pending_state/` —
  generated migration.
- `apps/api/src/common/config/env.validation.ts` — remove
  `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` (moved to being `apps/worker`-only).
- `apps/api/src/modules/ai/`: `ai-gateway.service.ts` (rewritten to
  `createPendingLog` only), `ai-gateway.service.spec.ts` (rewritten),
  `ai.module.ts` (rewritten, no provider construction), `ai.constants.ts`
  (deleted — `AI_PROVIDER` no longer used in `apps/api`), new
  `ai.events.ts`.
- `apps/api/src/queues/`: new `ai-processing.producer.ts` (+ spec), new
  `ai-processing-events-bridge.processor.ts` (+ spec), `queues.module.ts`
  updated.
- `apps/api/src/modules/tickets/`: `ticket-ai.service.ts` (rewritten),
  `ticket-ai.service.spec.ts` (rewritten), `tickets.controller.ts`
  (response type only), `tickets.module.ts` (imports `QueuesModule`).
- `apps/api/src/realtime/ticket-realtime.listener.ts` (+ spec) — one new
  handler.
- `apps/worker/src/queues/`: new `ai-processing.processor.ts` (+ spec),
  new `ai-processing-events.types.ts`, `worker.module.ts` updated.
- `apps/api/test/tickets.e2e-spec.ts` — the three existing AI describe
  blocks updated for the new async contract.
- `apps/api/test/ai-processing-producer.e2e-spec.ts` (new) — mirrors
  `health-check-producer.e2e-spec.ts` exactly: proves a real Redis enqueue,
  does not boot `apps/worker`, does not assert processing.

## Acceptance criteria

- No synchronous AI provider call remains anywhere in `apps/api`'s request
  path for any of the three endpoints.
- `POST /tickets/:id/ai/{summarize,suggest-reply,categorize}` still exist,
  still require `ticket:read`, still enforce Story 68 department
  visibility, and now return `{ id, outcome: "PENDING" }` immediately.
- Exactly one `AiPromptLog` row exists per submitted operation, created
  `PENDING` and later updated to its final outcome — never two rows.
- `apps/worker`'s `AiProcessingProcessor` resolves the provider only
  through `@crm/ai`/`AiProviderModule` — no duplicated Anthropic SDK code.
- A completed operation's outcome (`SUCCESS`/`ERROR`/`DISABLED`) and
  `latencyMs` are persisted on the same row, and a hand-back event results
  in exactly one `ticket:{id}` broadcast via the existing
  `TicketRealtimeListener` mechanism.
- No new realtime room, gateway, or queue beyond `ai-processing`/
  `ai-processing-events` is introduced.
- Every pre-existing test suite remains green, unweakened; the 8
  documented pre-existing e2e failures remain the only failures.

## Verification plan

- Unit tests: `AiGatewayService`, `TicketAiService`, `AiProcessingProducer`,
  `AiProcessingEventsBridgeProcessor` (`apps/api`), `AiProcessingProcessor`
  (`apps/worker`), `TicketRealtimeListener`'s new handler — all mirroring
  the exact mocking patterns their SLA-equivalents already established.
- e2e: the existing `tickets.e2e-spec.ts` AI blocks updated for the new
  response shape and `AiPromptLog` `PENDING` assertion (via
  `moduleRef.get(PrismaService)`, already wired in that file); a new
  dedicated producer e2e spec proving a real Redis enqueue, explicitly not
  booting `apps/worker` or asserting processing — same scope boundary
  `health-check-producer.e2e-spec.ts` already established for Story 14.
- Full workspace: `pnpm --filter @crm/api test`, `test:e2e`,
  `pnpm --filter @crm/worker test`, `pnpm typecheck`, `pnpm lint`,
  `pnpm build`.
