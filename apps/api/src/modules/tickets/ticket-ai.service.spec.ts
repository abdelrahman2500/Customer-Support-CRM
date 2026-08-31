import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketAiService } from "./ticket-ai.service";
import type { AiGatewayService } from "../ai/ai-gateway.service";
import type { AiCallResult } from "../ai/ai-provider.interface";
import type { TenantContext } from "../../common/tenant/tenant-context";
import type { TicketsService } from "./tickets.service";

function buildTicketsServiceMock() {
  return {
    getTicket: vi.fn(),
    getTicketNotes: vi.fn(),
  };
}

function buildAiGatewayMock() {
  return {
    summarize: vi.fn(),
  };
}

function buildTenantContextMock(branchId = "branch-1") {
  return {
    requireBranchScope: vi.fn(() => ({ branchId })),
  };
}

function createService(
  ticketsMock: ReturnType<typeof buildTicketsServiceMock>,
  aiGatewayMock: ReturnType<typeof buildAiGatewayMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
): TicketAiService {
  return new TicketAiService(
    ticketsMock as unknown as TicketsService,
    aiGatewayMock as unknown as AiGatewayService,
    tenantMock as unknown as TenantContext,
  );
}

const SUCCESS_RESULT: AiCallResult = {
  outcome: "SUCCESS",
  text: "A summary.",
  model: "claude-test",
  inputTokens: 10,
  outputTokens: 5,
  errorMessage: null,
};

describe("TicketAiService", () => {
  let ticketsService: ReturnType<typeof buildTicketsServiceMock>;
  let aiGateway: ReturnType<typeof buildAiGatewayMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: TicketAiService;

  beforeEach(() => {
    ticketsService = buildTicketsServiceMock();
    aiGateway = buildAiGatewayMock();
    tenantContext = buildTenantContextMock();
    service = createService(ticketsService, aiGateway, tenantContext);
  });

  describe("summarizeTicket", () => {
    it("loads the ticket (enforcing branch/department scope via getTicket) and its notes, then calls AiGatewayService.summarize", async () => {
      ticketsService.getTicket.mockResolvedValue({ id: "ticket-1", subject: "Login issue" });
      ticketsService.getTicketNotes.mockResolvedValue([
        { id: "n1", body: "Checked logs.", createdAt: new Date() },
        { id: "n2", body: "Reset password.", createdAt: new Date() },
      ]);
      aiGateway.summarize.mockResolvedValue(SUCCESS_RESULT);

      const result = await service.summarizeTicket("ticket-1");

      expect(ticketsService.getTicket).toHaveBeenCalledWith("ticket-1");
      expect(ticketsService.getTicketNotes).toHaveBeenCalledWith("ticket-1");
      expect(aiGateway.summarize).toHaveBeenCalledWith(
        { subject: "Login issue", body: "Checked logs.\n\nReset password." },
        "branch-1",
      );
      expect(result).toBe(SUCCESS_RESULT);
    });

    it("passes an empty body when the ticket has no notes yet", async () => {
      ticketsService.getTicket.mockResolvedValue({ id: "ticket-1", subject: "No notes yet" });
      ticketsService.getTicketNotes.mockResolvedValue([]);
      aiGateway.summarize.mockResolvedValue(SUCCESS_RESULT);

      await service.summarizeTicket("ticket-1");

      expect(aiGateway.summarize).toHaveBeenCalledWith(
        { subject: "No notes yet", body: "" },
        "branch-1",
      );
    });

    it("propagates a NotFoundException from getTicket for an out-of-scope ticket, never calling the AI gateway", async () => {
      const notFound = new Error("Ticket not found");
      ticketsService.getTicket.mockRejectedValue(notFound);

      await expect(service.summarizeTicket("unknown")).rejects.toThrow(notFound);
      expect(aiGateway.summarize).not.toHaveBeenCalled();
    });
  });
});
