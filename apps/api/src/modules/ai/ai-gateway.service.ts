import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AiFeature } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Story 72 — originally called the AI provider synchronously and logged
 * the result in one step. Story 76 — architecture correction: that
 * violated docs/architecture/02-system-architecture-overview.md's
 * Boundary rule 2 ("`apps/api` never blocks a request on slow external
 * work... calling the AI provider... always enqueued to BullMQ and
 * performed by `apps/worker`"). This service now only creates the
 * durable, in-flight `AiPromptLog` row *before* anything is enqueued —
 * the actual provider call and the row's completion update both happen
 * in `apps/worker`'s `AiProcessingProcessor`
 * (apps/worker/src/queues/ai-processing.processor.ts) via the worker's
 * own `PrismaService`, never here. This keeps exactly one `AiPromptLog`
 * row per submitted operation: created once by this service, updated
 * once by the worker — never duplicated, and this class never touches
 * an `AiProvider` at all anymore (see `AiModule`'s own doc comment for
 * why that construction was removed from `apps/api` entirely).
 */
@Injectable()
export class AiGatewayService {
  constructor(private readonly prisma: PrismaService) {}

  /** `model` is written as the placeholder `"pending"` — `apps/api`
   * cannot know in advance which provider the worker's own,
   * independent `AI_PROVIDER` resolution will select; the worker
   * overwrites it with the real value once resolved.
   *
   * Story 80 — `ticketId`/`chatSessionId` are mutually exclusive by
   * `feature`: a ticket-scoped operation (`TicketAiService.submit`)
   * passes its real `ticketId` and `null` for `chatSessionId`; a `CHAT`
   * operation (`AiChatService.sendMessage`) passes `null` for `ticketId`
   * and its real `chatSessionId`. */
  async createPendingLog(
    feature: AiFeature,
    branchId: string,
    ticketId: string | null,
    chatSessionId: string | null,
    promptRefValue: string,
  ): Promise<{ id: string }> {
    const log = await this.prisma.aiPromptLog.create({
      data: {
        branchId,
        ticketId,
        chatSessionId,
        feature,
        model: "pending",
        promptRef: promptRefValue,
        inputTokens: null,
        outputTokens: null,
        latencyMs: null,
        outcome: "PENDING",
        errorMessage: null,
      },
    });
    return { id: log.id };
  }

  /**
   * Story 81 — used when `AiSettingsService` reports the feature
   * disabled for this branch: creates the row already resolved to
   * `DISABLED`, without ever enqueueing `ai-processing`. `model:
   * "disabled"` matches `NullAiProvider`'s own convention exactly, so a
   * caller reading the log cannot distinguish "no API key configured"
   * from "a branch admin turned this feature off" — both are
   * legitimately "AI is off" from the caller's perspective (see this
   * story's own plan, "Design decision"). Same mutually-exclusive
   * `ticketId`/`chatSessionId` pair as `createPendingLog`.
   */
  async createDisabledLog(
    feature: AiFeature,
    branchId: string,
    ticketId: string | null,
    chatSessionId: string | null,
    promptRefValue: string,
  ): Promise<{ id: string }> {
    const log = await this.prisma.aiPromptLog.create({
      data: {
        branchId,
        ticketId,
        chatSessionId,
        feature,
        model: "disabled",
        promptRef: promptRefValue,
        inputTokens: null,
        outputTokens: null,
        latencyMs: null,
        outcome: "DISABLED",
        outputText: null,
        errorMessage: null,
      },
    });
    return { id: log.id };
  }
}

/** A short opaque reference, never the raw prompt body — see
 * `AiPromptLog`'s own doc comment in schema.prisma for why. Unchanged
 * from Story 72. */
export function promptRef(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 16);
}
