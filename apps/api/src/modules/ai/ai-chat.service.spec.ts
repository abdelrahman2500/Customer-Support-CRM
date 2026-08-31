import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatService } from "./ai-chat.service";
import type { AiGatewayService } from "./ai-gateway.service";
import type { AiProcessingProducer } from "../../queues/ai-processing.producer";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    chatSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
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
  return { createPendingLog: vi.fn() };
}

function buildAiProcessingProducerMock() {
  return { enqueue: vi.fn() };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  aiGatewayMock: ReturnType<typeof buildAiGatewayMock>,
  producerMock: ReturnType<typeof buildAiProcessingProducerMock>,
): AiChatService {
  return new AiChatService(
    prismaMock as unknown as PrismaService,
    aiGatewayMock as unknown as AiGatewayService,
    producerMock as unknown as AiProcessingProducer,
  );
}

describe("AiChatService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let aiGateway: ReturnType<typeof buildAiGatewayMock>;
  let producer: ReturnType<typeof buildAiProcessingProducerMock>;
  let service: AiChatService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    aiGateway = buildAiGatewayMock();
    producer = buildAiProcessingProducerMock();
    service = createService(prisma, aiGateway, producer);
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
});
