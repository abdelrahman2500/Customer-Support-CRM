import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";
import { AI_PROMPT_COMPLETED_EVENT } from "../modules/ai/ai.events";
import type { AiPromptCompletedEvent } from "../modules/ai/ai.events";
import { AI_CHAT_MESSAGE_COMPLETED_EVENT } from "../modules/ai/ai-chat.events";
import type { AiChatMessageCompletedEvent } from "../modules/ai/ai-chat.events";

/**
 * The dedicated worker-to-api AI hand-back queue — apps/worker's
 * `AiProcessingProcessor`
 * (apps/worker/src/queues/ai-processing.processor.ts) is this queue's
 * producer and duplicates this literal with a cross-reference comment,
 * the same convention Story 14 established for `HEALTH_CHECK_QUEUE` and
 * Story 15 established for `SLA_TIMER_EVENTS_QUEUE`. Not a generic event
 * bus — this queue carries only AI-processing completion results.
 */
export const AI_PROCESSING_EVENTS_QUEUE = "ai-processing-events";

/** The only shape a job on `AI_PROCESSING_EVENTS_QUEUE` ever takes.
 * Story 80 — `feature` now includes `CHAT`; `ticketId`/`chatSessionId`
 * are mutually exclusive by feature (both optional). */
export interface AiCompletionJobPayload {
  aiPromptLogId: string;
  feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE" | "CHAT";
  outcome: "SUCCESS" | "ERROR" | "DISABLED";
  ticketId?: string;
  chatSessionId?: string;
}

/**
 * Story 76 — apps/api's half of the AI hand-back bridge, mirroring
 * `SlaTimerEventsBridgeProcessor`'s exact restraint: translates one typed
 * job into exactly one `EventEmitter2.emit(...)` call. No notification/
 * business behavior of its own — `TicketRealtimeListener` is the only
 * current reactor to `ai.prompt_completed`.
 *
 * Story 80 — a `CHAT`-feature job emits the separate
 * `ai.chat_message_completed` event instead (`ChatRealtimeListener`'s own
 * reactor) — the three ticket-scoped features' `ai.prompt_completed`
 * emission is completely unchanged.
 */
@Injectable()
@Processor(AI_PROCESSING_EVENTS_QUEUE)
export class AiProcessingEventsBridgeProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessingEventsBridgeProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<AiCompletionJobPayload>): Promise<void> {
    if (job.data.feature === "CHAT") {
      const payload: AiChatMessageCompletedEvent = {
        aiPromptLogId: job.data.aiPromptLogId,
        chatSessionId: job.data.chatSessionId as string,
        outcome: job.data.outcome,
      };
      this.eventEmitter.emit(AI_CHAT_MESSAGE_COMPLETED_EVENT, payload);
      this.logger.log(
        `Emitted ${AI_CHAT_MESSAGE_COMPLETED_EVENT} for chat session ${job.data.chatSessionId}`,
      );
      return;
    }

    const payload: AiPromptCompletedEvent = {
      aiPromptLogId: job.data.aiPromptLogId,
      ticketId: job.data.ticketId as string,
      feature: job.data.feature,
      outcome: job.data.outcome,
    };
    this.eventEmitter.emit(AI_PROMPT_COMPLETED_EVENT, payload);
    this.logger.log(`Emitted ${AI_PROMPT_COMPLETED_EVENT} for ticket ${job.data.ticketId}`);
  }
}
