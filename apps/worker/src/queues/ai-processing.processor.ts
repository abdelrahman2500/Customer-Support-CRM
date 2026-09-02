import { randomUUID } from "node:crypto";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AiCallResult, AiProvider } from "@crm/ai";
import type { Job, Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { AI_PROVIDER } from "../ai/ai.constants";
import { AI_PROCESSING_EVENTS_QUEUE } from "./ai-processing-events.types";
import type { AiCompletionJobPayload } from "./ai-processing-events.types";
import { CorrelationIdStore } from "../common/logging/correlation-id.store";

/**
 * Must stay identical to `AI_PROCESSING_QUEUE` in
 * apps/api/src/queues/ai-processing.producer.ts.
 */
export const AI_PROCESSING_QUEUE = "ai-processing";

/** Must stay identical to `AiProcessingJobPayload` in
 * apps/api/src/queues/ai-processing.producer.ts.
 *
 * Story 80 — `feature` now includes `CHAT`. `ticketId`/`subject` are
 * ticket-scoped-only (optional); `chatSessionId` is `CHAT`-only
 * (optional); `body` is always present.
 *
 * Story 111 — `correlationId` is the enqueuing API request's own id.
 * `AiProcessingProcessor.process()` binds it (or a fresh one when
 * absent) for the lifetime of processing this job — see that class's own
 * doc comment. */
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
 *
 * Story 80 — `CHAT` added as a fourth feature (see
 * `docs/architecture/06-communication-and-realtime.md`: "`ai-processing`
 * for summaries, categorization, suggested replies, and chatbot work
 * that need not block requests" — this story's own plan resolves the
 * apparent tension with a more literal reading of a different doc in
 * `ai-processing`'s favor). On a `SUCCESS` outcome only, the assistant's
 * reply is additionally persisted as a `ChatMessage` row — the
 * conversation history's own source of truth; a failed/disabled turn is
 * never given a placeholder message (the caller learns of it via the
 * same `AiPromptLog` result-polling endpoint every other feature uses).
 *
 * Story 111 — `process()` binds `job.data.correlationId` (the enqueuing
 * API request's own id) via `CorrelationIdStore` for the lifetime of
 * processing this job, so every log line below — including the existing
 * ones, unchanged — carries it automatically via `PinoLoggerService`. A
 * job with no `correlationId` (there is none today, but nothing enforces
 * it) still gets a fresh one rather than an `undefined` field, keeping
 * every job's logs uniformly correlatable.
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
    return CorrelationIdStore.run(job.data.correlationId ?? randomUUID(), () =>
      this.processJob(job),
    );
  }

  private async processJob(job: Job<AiProcessingJobPayload>): Promise<void> {
    const { aiPromptLogId, ticketId, feature, chatSessionId } = job.data;
    const startedAt = Date.now();

    let result: AiCallResult;
    try {
      result = await this.call(job.data);
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

    if (feature === "CHAT" && result.outcome === "SUCCESS" && chatSessionId) {
      await this.prisma.chatMessage.create({
        data: { sessionId: chatSessionId, role: "ASSISTANT", body: result.text ?? "" },
      });
    }

    await this.handbackQueue.add("ai-completion", {
      aiPromptLogId,
      feature,
      outcome: result.outcome,
      ...(feature === "CHAT" ? { chatSessionId } : { ticketId }),
    });
    this.logger.log(`Completed ${feature} (${result.outcome}) for ${ticketId ?? chatSessionId}`);
  }

  private call(data: AiProcessingJobPayload): Promise<AiCallResult> {
    switch (data.feature) {
      case "SUMMARIZE":
        return this.provider.summarize({ subject: data.subject ?? "", body: data.body });
      case "SUGGEST_REPLY":
        return this.provider.suggestReply({ subject: data.subject ?? "", body: data.body });
      case "CATEGORIZE":
        return this.provider.categorize({ subject: data.subject ?? "", body: data.body });
      case "CHAT":
        return this.provider.chat({ sessionId: data.chatSessionId ?? "", message: data.body });
    }
  }
}
