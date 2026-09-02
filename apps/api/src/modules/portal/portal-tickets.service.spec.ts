import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { PortalTicketsService } from "./portal-tickets.service";
import type { PortalService } from "./portal.service";
import type { TicketsService } from "../tickets/tickets.service";
import type { TicketChannelService } from "../tickets/ticket-channel.service";
import type { AiChatService } from "../ai/ai-chat.service";
import type { AttachmentsService } from "../attachments/attachments.service";

function buildPortalServiceMock() {
  return { getAuthenticatedContact: vi.fn() };
}

function buildTicketsServiceMock() {
  return {
    createTicketForContact: vi.fn(),
    listTicketsForCustomer: vi.fn(),
    getTicketForCustomer: vi.fn(),
    getTicketHistoryForCustomer: vi.fn(),
    submitCsatForCustomer: vi.fn(),
    getCsatForCustomer: vi.fn(),
  };
}

function buildTicketChannelServiceMock() {
  return {
    createCustomerMessage: vi.fn(),
    listMessagesForCustomer: vi.fn(),
    recordAiChatTranscript: vi.fn(),
  };
}

function buildAiChatServiceMock() {
  return {
    getEscalationContext: vi.fn(),
    recordEscalation: vi.fn(),
  };
}

function buildAttachmentsServiceMock() {
  return {
    uploadAttachmentForCustomer: vi.fn(),
    listAttachmentsForCustomer: vi.fn(),
    getDownloadUrlForCustomer: vi.fn(),
  };
}

describe("PortalTicketsService", () => {
  let portalService: ReturnType<typeof buildPortalServiceMock>;
  let ticketsService: ReturnType<typeof buildTicketsServiceMock>;
  let ticketChannelService: ReturnType<typeof buildTicketChannelServiceMock>;
  let aiChatService: ReturnType<typeof buildAiChatServiceMock>;
  let attachmentsService: ReturnType<typeof buildAttachmentsServiceMock>;
  let service: PortalTicketsService;

  beforeEach(() => {
    vi.clearAllMocks();
    portalService = buildPortalServiceMock();
    ticketsService = buildTicketsServiceMock();
    ticketChannelService = buildTicketChannelServiceMock();
    aiChatService = buildAiChatServiceMock();
    attachmentsService = buildAttachmentsServiceMock();
    service = new PortalTicketsService(
      portalService as unknown as PortalService,
      ticketsService as unknown as TicketsService,
      ticketChannelService as unknown as TicketChannelService,
      aiChatService as unknown as AiChatService,
      attachmentsService as unknown as AttachmentsService,
    );
  });

  it("createTicket delegates directly to createTicketForContact (no customerId resolution needed)", async () => {
    ticketsService.createTicketForContact.mockResolvedValue({ id: "ticket-1" });

    const result = await service.createTicket("contact-1", { subject: "Cannot log in" });

    expect(portalService.getAuthenticatedContact).not.toHaveBeenCalled();
    expect(ticketsService.createTicketForContact).toHaveBeenCalledWith("contact-1", {
      subject: "Cannot log in",
    });
    expect(result).toEqual({ id: "ticket-1" });
  });

  it("listTickets resolves customerId from the authenticated contact, then delegates", async () => {
    portalService.getAuthenticatedContact.mockResolvedValue({
      id: "contact-1",
      email: "jane@example.com",
      fullName: "Jane Doe",
      customerId: "customer-1",
    });
    ticketsService.listTicketsForCustomer.mockResolvedValue([]);

    const result = await service.listTickets("contact-1");

    expect(portalService.getAuthenticatedContact).toHaveBeenCalledWith("contact-1");
    expect(ticketsService.listTicketsForCustomer).toHaveBeenCalledWith("customer-1");
    expect(result).toEqual([]);
  });

  it("getTicket resolves customerId, then delegates with the ticket id", async () => {
    portalService.getAuthenticatedContact.mockResolvedValue({ customerId: "customer-1" });
    ticketsService.getTicketForCustomer.mockResolvedValue({ id: "ticket-1" });

    const result = await service.getTicket("contact-1", "ticket-1");

    expect(ticketsService.getTicketForCustomer).toHaveBeenCalledWith("ticket-1", "customer-1");
    expect(result).toEqual({ id: "ticket-1" });
  });

  it("getTicketHistory resolves customerId, then delegates with the ticket id", async () => {
    portalService.getAuthenticatedContact.mockResolvedValue({ customerId: "customer-1" });
    ticketsService.getTicketHistoryForCustomer.mockResolvedValue([]);

    const result = await service.getTicketHistory("contact-1", "ticket-1");

    expect(ticketsService.getTicketHistoryForCustomer).toHaveBeenCalledWith(
      "ticket-1",
      "customer-1",
    );
    expect(result).toEqual([]);
  });

  // Story 55 — Customer Portal — Ticket CSAT / Feedback.
  it("submitCsat resolves customerId, then delegates with the ticket id and contact id", async () => {
    portalService.getAuthenticatedContact.mockResolvedValue({ customerId: "customer-1" });
    ticketsService.submitCsatForCustomer.mockResolvedValue({ id: "csat-1" });

    const result = await service.submitCsat("contact-1", "ticket-1", { rating: 5 });

    expect(portalService.getAuthenticatedContact).toHaveBeenCalledWith("contact-1");
    expect(ticketsService.submitCsatForCustomer).toHaveBeenCalledWith(
      "ticket-1",
      "customer-1",
      "contact-1",
      { rating: 5 },
    );
    expect(result).toEqual({ id: "csat-1" });
  });

  it("getCsat resolves customerId, then delegates with the ticket id", async () => {
    portalService.getAuthenticatedContact.mockResolvedValue({ customerId: "customer-1" });
    ticketsService.getCsatForCustomer.mockResolvedValue(null);

    const result = await service.getCsat("contact-1", "ticket-1");

    expect(ticketsService.getCsatForCustomer).toHaveBeenCalledWith("ticket-1", "customer-1");
    expect(result).toBeNull();
  });

  // Story 77 — Customer Portal Live Chat.
  it("sendMessage resolves customerId, then delegates to TicketChannelService.createCustomerMessage with the contact id", async () => {
    portalService.getAuthenticatedContact.mockResolvedValue({ customerId: "customer-1" });
    ticketChannelService.createCustomerMessage.mockResolvedValue({ id: "message-1" });

    const result = await service.sendMessage("contact-1", "ticket-1", { body: "Hi there" });

    expect(portalService.getAuthenticatedContact).toHaveBeenCalledWith("contact-1");
    expect(ticketChannelService.createCustomerMessage).toHaveBeenCalledWith(
      "ticket-1",
      "customer-1",
      "contact-1",
      "Hi there",
    );
    expect(result).toEqual({ id: "message-1" });
  });

  it("getMessages resolves customerId, then delegates with the ticket id", async () => {
    portalService.getAuthenticatedContact.mockResolvedValue({ customerId: "customer-1" });
    ticketChannelService.listMessagesForCustomer.mockResolvedValue([]);

    const result = await service.getMessages("contact-1", "ticket-1");

    expect(ticketChannelService.listMessagesForCustomer).toHaveBeenCalledWith(
      "ticket-1",
      "customer-1",
    );
    expect(result).toEqual([]);
  });

  // Story 103 — Customer Portal: Ticket Attachment Upload.
  describe("uploadAttachment", () => {
    it("resolves customerId, then delegates to AttachmentsService.uploadAttachmentForCustomer with the contact id", async () => {
      portalService.getAuthenticatedContact.mockResolvedValue({ customerId: "customer-1" });
      attachmentsService.uploadAttachmentForCustomer.mockResolvedValue({ id: "attachment-1" });
      const file = { originalname: "a.png", size: 10, mimetype: "image/png", buffer: Buffer.from("x") };

      const result = await service.uploadAttachment("contact-1", "ticket-1", file);

      expect(portalService.getAuthenticatedContact).toHaveBeenCalledWith("contact-1");
      expect(attachmentsService.uploadAttachmentForCustomer).toHaveBeenCalledWith(
        "ticket-1",
        "customer-1",
        "contact-1",
        file,
      );
      expect(result).toEqual({ id: "attachment-1" });
    });
  });

  describe("listAttachments", () => {
    it("resolves customerId, then delegates with the ticket id", async () => {
      portalService.getAuthenticatedContact.mockResolvedValue({ customerId: "customer-1" });
      attachmentsService.listAttachmentsForCustomer.mockResolvedValue([]);

      const result = await service.listAttachments("contact-1", "ticket-1");

      expect(attachmentsService.listAttachmentsForCustomer).toHaveBeenCalledWith(
        "ticket-1",
        "customer-1",
      );
      expect(result).toEqual([]);
    });
  });

  describe("getAttachmentDownloadUrl", () => {
    it("resolves customerId, then delegates with the ticket and attachment ids", async () => {
      portalService.getAuthenticatedContact.mockResolvedValue({ customerId: "customer-1" });
      attachmentsService.getDownloadUrlForCustomer.mockResolvedValue("https://example.test/presigned");

      const result = await service.getAttachmentDownloadUrl("contact-1", "ticket-1", "attachment-1");

      expect(attachmentsService.getDownloadUrlForCustomer).toHaveBeenCalledWith(
        "ticket-1",
        "customer-1",
        "attachment-1",
      );
      expect(result).toBe("https://example.test/presigned");
    });
  });

  // Story 85 — AI Chat: Escalate to a Human Ticket.
  describe("escalateChatSession", () => {
    it("creates a ticket with a subject derived from the first CUSTOMER message, replays the transcript, and records the escalation", async () => {
      const messages = [
        { id: "m1", role: "CUSTOMER", body: "Cannot log in to my account", createdAt: new Date() },
        { id: "m2", role: "ASSISTANT", body: "Have you tried resetting your password?", createdAt: new Date() },
      ];
      aiChatService.getEscalationContext.mockResolvedValue({
        id: "session-1",
        branchId: "branch-1",
        escalatedTicketId: null,
        messages,
      });
      ticketsService.createTicketForContact.mockResolvedValue({ id: "ticket-1" });

      const result = await service.escalateChatSession("contact-1", "session-1");

      expect(aiChatService.getEscalationContext).toHaveBeenCalledWith("contact-1", "session-1");
      expect(ticketsService.createTicketForContact).toHaveBeenCalledWith("contact-1", {
        subject: "Cannot log in to my account",
      });
      expect(ticketChannelService.recordAiChatTranscript).toHaveBeenCalledWith(
        "ticket-1",
        "contact-1",
        messages,
      );
      expect(aiChatService.recordEscalation).toHaveBeenCalledWith(
        "contact-1",
        "session-1",
        "ticket-1",
      );
      expect(result).toEqual({ ticketId: "ticket-1" });
    });

    it("truncates a long first CUSTOMER message to 120 characters for the ticket subject", async () => {
      const longBody = "a".repeat(200);
      aiChatService.getEscalationContext.mockResolvedValue({
        id: "session-1",
        branchId: "branch-1",
        escalatedTicketId: null,
        messages: [{ id: "m1", role: "CUSTOMER", body: longBody, createdAt: new Date() }],
      });
      ticketsService.createTicketForContact.mockResolvedValue({ id: "ticket-1" });

      await service.escalateChatSession("contact-1", "session-1");

      expect(ticketsService.createTicketForContact).toHaveBeenCalledWith("contact-1", {
        subject: "a".repeat(120),
      });
    });

    it("is idempotent: returns the existing ticketId without creating anything when already escalated", async () => {
      aiChatService.getEscalationContext.mockResolvedValue({
        id: "session-1",
        branchId: "branch-1",
        escalatedTicketId: "ticket-existing",
        messages: [{ id: "m1", role: "CUSTOMER", body: "Hi", createdAt: new Date() }],
      });

      const result = await service.escalateChatSession("contact-1", "session-1");

      expect(result).toEqual({ ticketId: "ticket-existing" });
      expect(ticketsService.createTicketForContact).not.toHaveBeenCalled();
      expect(ticketChannelService.recordAiChatTranscript).not.toHaveBeenCalled();
      expect(aiChatService.recordEscalation).not.toHaveBeenCalled();
    });

    it("throws BadRequestException and creates nothing for a session with no messages", async () => {
      aiChatService.getEscalationContext.mockResolvedValue({
        id: "session-1",
        branchId: "branch-1",
        escalatedTicketId: null,
        messages: [],
      });

      await expect(service.escalateChatSession("contact-1", "session-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(ticketsService.createTicketForContact).not.toHaveBeenCalled();
    });

    it("propagates the 404-equivalent rejection when the session belongs to a different contact", async () => {
      aiChatService.getEscalationContext.mockRejectedValue(new Error("Chat session not found"));

      await expect(service.escalateChatSession("contact-1", "session-1")).rejects.toThrow(
        "Chat session not found",
      );
      expect(ticketsService.createTicketForContact).not.toHaveBeenCalled();
    });
  });
});
