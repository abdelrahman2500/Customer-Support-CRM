import { Injectable, NotFoundException } from "@nestjs/common";
import type { AiOutcome, ChatMessageRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AiGatewayService, promptRef } from "./ai-gateway.service";
import { AiSettingsService } from "./ai-settings.service";
import { AiProcessingProducer } from "../../queues/ai-processing.producer";

export interface ChatMessageSummary {
  id: string;
  role: ChatMessageRole;
  body: string;
  createdAt: Date;
}

/** Mirrors `TicketAiService`'s own `AiResultResponse` shape (Story 79),
 * scoped to a chat session rather than a ticket. Kept as a separate type
 * (not imported from the tickets module) — the `ai` domain has no reason
 * to depend on `tickets`, and the shape is trivial to duplicate. */
export interface AiChatResultResponse {
  id: string;
  outcome: AiOutcome;
  outputText: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

/**
 * Story 80 — the first real call site of `AiProvider.chat()`. Composes
 * `AiGatewayService`/`AiProcessingProducer` exactly the way
 * `TicketAiService` does (see that service's own doc comment), routing
 * `CHAT` through the same `ai-processing` async queue rather than a new
 * direct-call path — see this story's own plan, "Design decision".
 *
 * `getOwnedSession`'s "session doesn't exist" / "belongs to another
 * Contact" masking-as-404 mirrors `TicketAiService.getAiResult`'s own
 * documented convention exactly.
 */
@Injectable()
export class AiChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly aiProcessingProducer: AiProcessingProducer,
    private readonly aiSettingsService: AiSettingsService,
  ) {}

  async startSession(contactId: string, branchId: string): Promise<{ id: string }> {
    const session = await this.prisma.chatSession.create({ data: { contactId, branchId } });
    return { id: session.id };
  }

  async sendMessage(
    contactId: string,
    sessionId: string,
    body: string,
  ): Promise<{ id: string; outcome: "PENDING" | "DISABLED" }> {
    const session = await this.getOwnedSession(contactId, sessionId);
    await this.prisma.chatMessage.create({
      data: { sessionId: session.id, role: "CUSTOMER", body },
    });

    if (!(await this.aiSettingsService.isFeatureEnabled(session.branchId, "CHAT"))) {
      const disabledLog = await this.aiGatewayService.createDisabledLog(
        "CHAT",
        session.branchId,
        null,
        session.id,
        promptRef(session.id, body),
      );
      return { id: disabledLog.id, outcome: "DISABLED" };
    }

    const log = await this.aiGatewayService.createPendingLog(
      "CHAT",
      session.branchId,
      null,
      session.id,
      promptRef(session.id, body),
    );

    await this.aiProcessingProducer.enqueue({
      aiPromptLogId: log.id,
      branchId: session.branchId,
      feature: "CHAT",
      body,
      chatSessionId: session.id,
    });

    return { id: log.id, outcome: "PENDING" };
  }

  async getMessages(contactId: string, sessionId: string): Promise<ChatMessageSummary[]> {
    const session = await this.getOwnedSession(contactId, sessionId);
    return this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
  }

  async getAiResult(
    contactId: string,
    sessionId: string,
    logId: string,
  ): Promise<AiChatResultResponse> {
    await this.getOwnedSession(contactId, sessionId);
    const log = await this.prisma.aiPromptLog.findUnique({ where: { id: logId } });
    if (!log || log.chatSessionId !== sessionId) {
      throw new NotFoundException("AI result not found");
    }
    return {
      id: log.id,
      outcome: log.outcome,
      outputText: log.outputText,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt,
    };
  }

  /** Masks "session doesn't exist" and "belongs to another Contact"
   * identically as 404. */
  private async getOwnedSession(
    contactId: string,
    sessionId: string,
  ): Promise<{ id: string; branchId: string; contactId: string }> {
    const session = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session || session.contactId !== contactId) {
      throw new NotFoundException("Chat session not found");
    }
    return session;
  }
}
