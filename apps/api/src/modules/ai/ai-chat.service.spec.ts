import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatService } from "./ai-chat.service";
import type { AiGatewayService } from "./ai-gateway.service";
import type { AiSettingsService } from "./ai-settings.service";
import type { AiProcessingProducer } from "../../queues/ai-processing.producer";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    chatSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    aiPromptLog: {
      findUnique: vi.fn(),
    },
  };
}

function buildAiGatewayMock() {
  return { createPendingLog: vi.fn(), createDisabledLog: vi.fn() };
}

function buildAiProcessingProducerMock() {
  return { enqueue: vi.fn() };
}

function buildAiSettingsMock(enabled = true) {
  return { isFeatureEnabled: vi.fn().mockResolvedValue(enabled) };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  aiGatewayMock: ReturnType<typeof buildAiGatewayMock>,
  producerMock: ReturnType<typeof buildAiProcessingProducerMock>,
  aiSettingsMock: ReturnType<typeof buildAiSettingsMock>,
): AiChatService {
  return new AiChatService(
    prismaMock as unknown as PrismaService,
    aiGatewayMock as unknown as AiGatewayService,
    producerMock as unknown as AiProcessingProducer,
    aiSettingsMock as unknown as AiSettingsService,
  );
}

describe("AiChatService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let aiGateway: ReturnType<typeof buildAiGatewayMock>;
  let producer: ReturnType<typeof buildAiProcessingProducerMock>;
  let aiSettings: ReturnType<typeof buildAiSettingsMock>;
  let service: AiChatService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    aiGateway = buildAiGatewayMock();
    producer = buildAiProcessingProducerMock();
    aiSettings = buildAiSettingsMock();
    service = createService(prisma, aiGateway, producer, aiSettings);
  });

  describe("startSession", () => {
    it("creates a ChatSession scoped to the contact and branch", async () => {
      prisma.chatSession.create.mockResolvedValue({ id: "session-1" });

      const result = await service.startSession("contact-1", "branch-1");

      expect(prisma.chatSession.create).toHaveBeenCalledWith({
        data: { contactId: "contact-1", branchId: "branch-1" },
      });
      expect(result).toEqual({ id: "session-1" });
    });
  });

  describe("sendMessage", () => {
    beforeEach(() => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "contact-1",
        branchId: "branch-1",
      });
      aiGateway.createPendingLog.mockResolvedValue({ id: "log-1" });
    });

    it("persists the customer message, creates a pending log with chatSessionId, and enqueues the job", async () => {
      const result = await service.sendMessage("contact-1", "session-1", "Hi, I need help");

      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: { sessionId: "session-1", role: "CUSTOMER", body: "Hi, I need help" },
      });
      expect(aiGateway.createPendingLog).toHaveBeenCalledWith(
        "CHAT",
        "branch-1",
        null,
        "session-1",
        expect.any(String),
      );
      expect(producer.enqueue).toHaveBeenCalledWith({
        aiPromptLogId: "log-1",
        branchId: "branch-1",
        feature: "CHAT",
        body: "Hi, I need help",
        chatSessionId: "session-1",
      });
      expect(result).toEqual({ id: "log-1", outcome: "PENDING" });
    });

    it("throws (404-equivalent) when the session belongs to a different contact", async () => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "someone-else",
        branchId: "branch-1",
      });

      await expect(service.sendMessage("contact-1", "session-1", "hi")).rejects.toThrow(
        "Chat session not found",
      );
      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
      expect(producer.enqueue).not.toHaveBeenCalled();
    });

    it("throws when no session with that id exists", async () => {
      prisma.chatSession.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage("contact-1", "unknown", "hi")).rejects.toThrow(
        "Chat session not found",
      );
    });

    // Story 81 — AI Feature Flags per Branch.
    it("still persists the customer message but creates a DISABLED log and never enqueues when chat is disabled for the branch", async () => {
      aiSettings.isFeatureEnabled.mockResolvedValue(false);
      aiGateway.createDisabledLog.mockResolvedValue({ id: "log-disabled" });

      const result = await service.sendMessage("contact-1", "session-1", "Hi, I need help");

      expect(aiSettings.isFeatureEnabled).toHaveBeenCalledWith("branch-1", "CHAT");
      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: { sessionId: "session-1", role: "CUSTOMER", body: "Hi, I need help" },
      });
      expect(aiGateway.createDisabledLog).toHaveBeenCalledWith(
        "CHAT",
        "branch-1",
        null,
        "session-1",
        expect.any(String),
      );
      expect(aiGateway.createPendingLog).not.toHaveBeenCalled();
      expect(producer.enqueue).not.toHaveBeenCalled();
      expect(result).toEqual({ id: "log-disabled", outcome: "DISABLED" });
    });
  });

  describe("getMessages", () => {
    it("returns the chronological message list for the owning contact", async () => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "contact-1",
        branchId: "branch-1",
      });
      const messages = [{ id: "m1", role: "CUSTOMER", body: "hi", createdAt: new Date() }];
      prisma.chatMessage.findMany.mockResolvedValue(messages);

      const result = await service.getMessages("contact-1", "session-1");

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId: "session-1" },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual(messages);
    });

    it("throws for a session belonging to a different contact", async () => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "someone-else",
        branchId: "branch-1",
      });

      await expect(service.getMessages("contact-1", "session-1")).rejects.toThrow(
        "Chat session not found",
      );
      expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getAiResult", () => {
    beforeEach(() => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "contact-1",
        branchId: "branch-1",
      });
    });

    it("returns the mapped result when the log exists and its chatSessionId matches", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      prisma.aiPromptLog.findUnique.mockResolvedValue({
        id: "log-1",
        chatSessionId: "session-1",
        outcome: "SUCCESS",
        outputText: "Sure, I can help with that.",
        errorMessage: null,
        createdAt,
      });

      const result = await service.getAiResult("contact-1", "session-1", "log-1");

      expect(result).toEqual({
        id: "log-1",
        outcome: "SUCCESS",
        outputText: "Sure, I can help with that.",
        errorMessage: null,
        createdAt,
      });
    });

    it("throws when the log's chatSessionId doesn't match", async () => {
      prisma.aiPromptLog.findUnique.mockResolvedValue({
        id: "log-1",
        chatSessionId: "session-2",
        outcome: "SUCCESS",
        outputText: "text",
        errorMessage: null,
        createdAt: new Date(),
      });

      await expect(service.getAiResult("contact-1", "session-1", "log-1")).rejects.toThrow(
        "AI result not found",
      );
    });

    it("throws when no log with that id exists", async () => {
      prisma.aiPromptLog.findUnique.mockResolvedValue(null);

      await expect(service.getAiResult("contact-1", "session-1", "unknown")).rejects.toThrow(
        "AI result not found",
      );
    });

    it("never queries AiPromptLog if the session lookup itself rejects (cross-contact)", async () => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "someone-else",
        branchId: "branch-1",
      });

      await expect(service.getAiResult("contact-1", "session-1", "log-1")).rejects.toThrow(
        "Chat session not found",
      );
      expect(prisma.aiPromptLog.findUnique).not.toHaveBeenCalled();
    });
  });

  // Story 85 — AI Chat: Escalate to a Human Ticket.
  describe("getEscalationContext", () => {
    it("returns the session's branchId, escalatedTicketId, and chronological messages", async () => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "contact-1",
        branchId: "branch-1",
        escalatedTicketId: null,
      });
      const messages = [{ id: "m1", role: "CUSTOMER", body: "hi", createdAt: new Date() }];
      prisma.chatMessage.findMany.mockResolvedValue(messages);

      const result = await service.getEscalationContext("contact-1", "session-1");

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { sessionId: "session-1" },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual({
        id: "session-1",
        branchId: "branch-1",
        escalatedTicketId: null,
        messages,
      });
    });

    it("reflects a previously-recorded escalatedTicketId", async () => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "contact-1",
        branchId: "branch-1",
        escalatedTicketId: "ticket-1",
      });
      prisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await service.getEscalationContext("contact-1", "session-1");

      expect(result.escalatedTicketId).toBe("ticket-1");
    });

    it("throws (404-equivalent) for a session belonging to a different contact", async () => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "someone-else",
        branchId: "branch-1",
        escalatedTicketId: null,
      });

      await expect(service.getEscalationContext("contact-1", "session-1")).rejects.toThrow(
        "Chat session not found",
      );
      expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
    });

    it("throws for a nonexistent session id", async () => {
      prisma.chatSession.findUnique.mockResolvedValue(null);

      await expect(service.getEscalationContext("contact-1", "unknown")).rejects.toThrow(
        "Chat session not found",
      );
    });
  });

  describe("recordEscalation", () => {
    beforeEach(() => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "contact-1",
        branchId: "branch-1",
        escalatedTicketId: null,
      });
    });

    it("re-verifies ownership, then sets escalatedTicketId", async () => {
      await service.recordEscalation("contact-1", "session-1", "ticket-1");

      expect(prisma.chatSession.findUnique).toHaveBeenCalledWith({ where: { id: "session-1" } });
      expect(prisma.chatSession.update).toHaveBeenCalledWith({
        where: { id: "session-1" },
        data: { escalatedTicketId: "ticket-1" },
      });
    });

    it("throws (404-equivalent) for a session belonging to a different contact, never updating", async () => {
      prisma.chatSession.findUnique.mockResolvedValue({
        id: "session-1",
        contactId: "someone-else",
        branchId: "branch-1",
        escalatedTicketId: null,
      });

      await expect(service.recordEscalation("contact-1", "session-1", "ticket-1")).rejects.toThrow(
        "Chat session not found",
      );
      expect(prisma.chatSession.update).not.toHaveBeenCalled();
    });
  });
});
