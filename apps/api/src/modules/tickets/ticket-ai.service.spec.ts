import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketAiService } from "./ticket-ai.service";
import type { AiGatewayService } from "../ai/ai-gateway.service";
import type { AiProcessingProducer } from "../../queues/ai-processing.producer";
import type { TenantContext } from "../../common/tenant/tenant-context";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TicketsService } from "./tickets.service";

function buildTicketsServiceMock() {
  return {
    getTicket: vi.fn(),
    getTicketNotes: vi.fn(),
  };
}

function buildAiGatewayMock() {
  return {
    createPendingLog: vi.fn(),
  };
}

function buildAiProcessingProducerMock() {
  return {
    enqueue: vi.fn(),
  };
}

function buildTenantContextMock(branchId = "branch-1") {
  return {
    requireBranchScope: vi.fn(() => ({ branchId })),
  };
}

function buildPrismaMock() {
  return {
    aiPromptLog: {
      findUnique: vi.fn(),
    },
  };
}

function createService(
  ticketsMock: ReturnType<typeof buildTicketsServiceMock>,
  aiGatewayMock: ReturnType<typeof buildAiGatewayMock>,
  producerMock: ReturnType<typeof buildAiProcessingProducerMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
  prismaMock: ReturnType<typeof buildPrismaMock>,
): TicketAiService {
  return new TicketAiService(
    ticketsMock as unknown as TicketsService,
    aiGatewayMock as unknown as AiGatewayService,
    producerMock as unknown as AiProcessingProducer,
    tenantMock as unknown as TenantContext,
    prismaMock as unknown as PrismaService,
  );
}

describe("TicketAiService", () => {
  let ticketsService: ReturnType<typeof buildTicketsServiceMock>;
  let aiGateway: ReturnType<typeof buildAiGatewayMock>;
  let producer: ReturnType<typeof buildAiProcessingProducerMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: TicketAiService;

  beforeEach(() => {
    ticketsService = buildTicketsServiceMock();
    aiGateway = buildAiGatewayMock();
    producer = buildAiProcessingProducerMock();
    tenantContext = buildTenantContextMock();
    prisma = buildPrismaMock();
    service = createService(ticketsService, aiGateway, producer, tenantContext, prisma);

    ticketsService.getTicket.mockResolvedValue({ id: "ticket-1", subject: "Login issue" });
    ticketsService.getTicketNotes.mockResolvedValue([
      { id: "n1", body: "Checked logs.", createdAt: new Date() },
      { id: "n2", body: "Reset password.", createdAt: new Date() },
    ]);
    aiGateway.createPendingLog.mockResolvedValue({ id: "log-1" });
    producer.enqueue.mockResolvedValue({ id: "job-1" });
  });

  describe("summarizeTicket", () => {
    it("loads the ticket (enforcing branch/department scope via getTicket) and its notes, creates a pending log, enqueues ai-processing, and returns the PENDING response", async () => {
      const result = await service.summarizeTicket("ticket-1");

      expect(ticketsService.getTicket).toHaveBeenCalledWith("ticket-1");
      expect(ticketsService.getTicketNotes).toHaveBeenCalledWith("ticket-1");
      expect(aiGateway.createPendingLog).toHaveBeenCalledWith(
        "SUMMARIZE",
        "branch-1",
        "ticket-1",
        null,
        expect.any(String),
      );
      expect(producer.enqueue).toHaveBeenCalledWith({
        aiPromptLogId: "log-1",
        ticketId: "ticket-1",
        branchId: "branch-1",
        feature: "SUMMARIZE",
        subject: "Login issue",
        body: "Checked logs.\n\nReset password.",
      });
      expect(result).toEqual({ id: "log-1", outcome: "PENDING" });
    });

    it("passes an empty body when the ticket has no notes yet", async () => {
      ticketsService.getTicketNotes.mockResolvedValue([]);

      await service.summarizeTicket("ticket-1");

      expect(producer.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ body: "" }),
      );
    });

    it("never calls the AI producer if loading the ticket fails (out-of-scope ticket)", async () => {
      const notFound = new Error("Ticket not found");
      ticketsService.getTicket.mockRejectedValue(notFound);

      await expect(service.summarizeTicket("unknown")).rejects.toThrow(notFound);
      expect(aiGateway.createPendingLog).not.toHaveBeenCalled();
      expect(producer.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("suggestReplyForTicket", () => {
    it("submits with feature SUGGEST_REPLY", async () => {
      const result = await service.suggestReplyForTicket("ticket-1");

      expect(aiGateway.createPendingLog).toHaveBeenCalledWith(
        "SUGGEST_REPLY",
        "branch-1",
        "ticket-1",
        null,
        expect.any(String),
      );
      expect(producer.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ feature: "SUGGEST_REPLY" }),
      );
      expect(result).toEqual({ id: "log-1", outcome: "PENDING" });
    });
  });

  describe("categorizeTicket", () => {
    it("submits with feature CATEGORIZE", async () => {
      const result = await service.categorizeTicket("ticket-1");

      expect(aiGateway.createPendingLog).toHaveBeenCalledWith(
        "CATEGORIZE",
        "branch-1",
        "ticket-1",
        null,
        expect.any(String),
      );
      expect(producer.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ feature: "CATEGORIZE" }),
      );
      expect(result).toEqual({ id: "log-1", outcome: "PENDING" });
    });
  });

  describe("getAiResult", () => {
    it("returns the mapped result when the log exists and its ticketId matches", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      prisma.aiPromptLog.findUnique.mockResolvedValue({
        id: "log-1",
        ticketId: "ticket-1",
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
        outputText: "A summary.",
        errorMessage: null,
        createdAt,
      });

      const result = await service.getAiResult("ticket-1", "log-1");

      expect(ticketsService.getTicket).toHaveBeenCalledWith("ticket-1");
      expect(prisma.aiPromptLog.findUnique).toHaveBeenCalledWith({ where: { id: "log-1" } });
      expect(result).toEqual({
        id: "log-1",
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
        outputText: "A summary.",
        errorMessage: null,
        createdAt,
      });
    });

    it("throws when the log's ticketId doesn't match", async () => {
      prisma.aiPromptLog.findUnique.mockResolvedValue({
        id: "log-1",
        ticketId: "ticket-2",
        feature: "SUMMARIZE",
        outcome: "SUCCESS",
        outputText: "A summary.",
        errorMessage: null,
        createdAt: new Date(),
      });

      await expect(service.getAiResult("ticket-1", "log-1")).rejects.toThrow(
        "AI result not found",
      );
    });

    it("throws when no log with that id exists", async () => {
      prisma.aiPromptLog.findUnique.mockResolvedValue(null);

      await expect(service.getAiResult("ticket-1", "unknown-log")).rejects.toThrow(
        "AI result not found",
      );
    });

    it("never queries AiPromptLog if getTicket itself rejects", async () => {
      const notFound = new Error("Ticket not found");
      ticketsService.getTicket.mockRejectedValue(notFound);

      await expect(service.getAiResult("unknown", "log-1")).rejects.toThrow(notFound);
      expect(prisma.aiPromptLog.findUnique).not.toHaveBeenCalled();
    });
  });
});
