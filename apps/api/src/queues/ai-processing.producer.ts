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

/** `feature` is deliberately narrower than the full `AiFeature` Prisma
 * enum — `CHAT` has no producer yet (chatbot is out of scope for this
 * story, see the plan's own Non-goals). */
export interface AiProcessingJobPayload {
  aiPromptLogId: string;
  ticketId: string;
  branchId: string;
  feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE";
  subject: string;
  body: string;
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
