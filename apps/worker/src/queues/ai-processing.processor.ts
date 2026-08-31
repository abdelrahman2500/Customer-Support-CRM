import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AiCallResult, AiProvider, AiTicketInput } from "@crm/ai";
import type { Job, Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { AI_PROVIDER } from "../ai/ai.constants";
import { AI_PROCESSING_EVENTS_QUEUE } from "./ai-processing-events.types";
import type { AiCompletionJobPayload } from "./ai-processing-events.types";

/**
 * Must stay identical to `AI_PROCESSING_QUEUE` in
 * apps/api/src/queues/ai-processing.producer.ts.
 */
export const AI_PROCESSING_QUEUE = "ai-processing";

/** Must stay identical to `AiProcessingJobPayload` in
 * apps/api/src/queues/ai-processing.producer.ts. */
export interface AiProcessingJobPayload {
  aiPromptLogId: string;
  ticketId: string;
  branchId: string;
  feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE";
  subject: string;
  body: string;
}

/**
 * Story 76 — `apps/worker`'s half of the AI async correction
 * (docs/architecture/02-system-architecture-overview.md: "`apps/api`
 * never blocks a request on slow external work... calling the AI
 * provider... always enqueued to BullMQ and performed by `apps/worker`").
 * Resolves the shared `AiProvider` from `AiProviderModule` (already
 * wired for exactly this — see that module's own doc comment), calls the
 * matching method, durably updates the pre-created `AiPromptLog` row via
 * this app's own `PrismaService` (mirrors `SlaTimerProcessor` updating
 * `SlaTicketTarget` directly, never through an API-side service call),
 * and hands the outcome back to `apps/api` via `ai-processing-events` —
 * mirrors `SlaTimerProcessor`'s exact hand-back-queue shape (Story 15's
 * own precedent).
 *
 * The job carries an already-authorized operation — Story 68's
 * department-visibility check and every other ticket-authorization
 * decision already happened in `apps/api`'s HTTP request, before this
 * job was ever enqueued. This processor never re-derives or re-checks
 * ticket access, and never constructs its own `AiProvider` — only the
 * one `@crm/ai` implementation `AiProviderModule` already selected.
 */
@Injectable()
@Processor(AI_PROCESSING_QUEUE)
export class AiProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessingProcessor.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly prisma: PrismaService,
    @InjectQueue(AI_PROCESSING_EVENTS_QUEUE)
    private readonly handbackQueue: Queue<AiCompletionJobPayload>,
  ) {
    super();
  }

  async process(job: Job<AiProcessingJobPayload>): Promise<void> {
    const { aiPromptLogId, ticketId, feature, subject, body } = job.data;
    const input: AiTicketInput = { subject, body };
    const startedAt = Date.now();

    let result: AiCallResult;
    try {
      result = await this.call(feature, input);
    } catch (error) {
      // The `AiProvider` contract says implementations never throw, but a
      // future/misbehaving provider still shouldn't leave the durable log
      // row stuck in PENDING forever — mirrors `AiGatewayService`'s own
      // (pre-Story-76) defensive try/catch exactly.
      result = {
        outcome: "ERROR",
        text: null,
        model: "unknown",
        inputTokens: null,
        outputTokens: null,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
    const latencyMs = Date.now() - startedAt;

    await this.prisma.aiPromptLog.update({
      where: { id: aiPromptLogId },
      data: {
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs,
        outcome: result.outcome,
        outputText: result.text,
        errorMessage: result.errorMessage,
      },
    });

    await this.handbackQueue.add("ai-completion", {
      aiPromptLogId,
      ticketId,
      feature,
      outcome: result.outcome,
    });
    this.logger.log(`Completed ${feature} (${result.outcome}) for ticket ${ticketId}`);
  }

  private call(feature: AiProcessingJobPayload["feature"], input: AiTicketInput): Promise<AiCallResult> {
    switch (feature) {
      case "SUMMARIZE":
        return this.provider.summarize(input);
      case "SUGGEST_REPLY":
        return this.provider.suggestReply(input);
      case "CATEGORIZE":
        return this.provider.categorize(input);
    }
  }
}
