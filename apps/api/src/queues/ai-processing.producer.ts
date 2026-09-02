import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";

/**
 * Must stay identical to `AI_PROCESSING_QUEUE` in
 * apps/worker/src/queues/ai-processing.processor.ts — no cross-app
 * shared-constants mechanism exists in this repository (Story 14's own
 * precedent for `HEALTH_CHECK_QUEUE`), so this is a deliberately
 * duplicated literal, not an import.
 */
export const AI_PROCESSING_QUEUE = "ai-processing";

/** Story 80 — `feature` now includes `CHAT` alongside the three
 * ticket-scoped features. `ticketId`/`subject` are ticket-scoped-only
 * (optional); `chatSessionId` is `CHAT`-only (optional); `body` is always
 * present — the joined note text for ticket features, the customer's raw
 * chat message for `CHAT`.
 *
 * Story 111 — `correlationId` is the enqueuing HTTP request's own id
 * (`CorrelationIdStore.get()`, set for the request's lifetime by
 * `RequestIdMiddleware`), optional only because a caller outside an HTTP
 * request (there is none today, but nothing enforces it) would have none
 * to propagate. `apps/worker`'s `AiProcessingProcessor` falls back to a
 * fresh id when absent — see that file's own doc comment. */
export interface AiProcessingJobPayload {
  aiPromptLogId: string;
  branchId: string;
  feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE" | "CHAT";
  ticketId?: string;
  subject?: string;
  body: string;
  chatSessionId?: string;
  correlationId?: string;
}

/**
 * Story 76 — the API-side producer for `ai-processing`
 * (docs/architecture/06-communication-and-realtime.md: "ai-processing for
 * summaries, categorization, and suggested replies... that need not
 * block requests"). Mirrors `HealthCheckProducer`'s exact shape (Story
 * 14's own precedent): one queue, one job shape, one method.
 * `TicketAiService` calls this only after already creating the durable
 * `AiPromptLog` row and performing every ticket-authorization check — the
 * payload carries only already-authorized data, never anything the
 * worker would need to re-derive or re-check.
 */
@Injectable()
export class AiProcessingProducer {
  constructor(
    @InjectQueue(AI_PROCESSING_QUEUE) private readonly queue: Queue<AiProcessingJobPayload>,
  ) {}

  async enqueue(payload: AiProcessingJobPayload): Promise<Job<AiProcessingJobPayload>> {
    return this.queue.add("process", payload);
  }
}
