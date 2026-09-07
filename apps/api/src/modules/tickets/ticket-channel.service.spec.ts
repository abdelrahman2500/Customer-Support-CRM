import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketChannelService } from "./ticket-channel.service";
import type { ChannelMessagesService } from "../channels/channel-messages.service";
import type { TenantContext } from "../../common/tenant/tenant-context";
import type { CustomersService } from "../customers/customers.service";
import type { TicketsService } from "./tickets.service";

function buildTicketsServiceMock() {
  return {
    getTicket: vi.fn(),
    getTicketForCustomer: vi.fn(),
  };
}

function buildChannelMessagesServiceMock() {
  return {
    createOutboundFromUser: vi.fn(),
    createInboundFromContact: vi.fn(),
    createSystemMessage: vi.fn(),
    enqueueOutboundDelivery: vi.fn(),
    listForTicket: vi.fn(),
  };
}

function buildTenantContextMock(userId: string | null = "user-1") {
  return { userId };
}

function buildCustomersServiceMock() {
  return {
    getCustomer: vi.fn(),
  };
}

function createService(
  ticketsMock: ReturnType<typeof buildTicketsServiceMock>,
  channelMessagesMock: ReturnType<typeof buildChannelMessagesServiceMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
  customersMock: ReturnType<typeof buildCustomersServiceMock> = buildCustomersServiceMock(),
): TicketChannelService {
  return new TicketChannelService(
    ticketsMock as unknown as TicketsService,
    channelMessagesMock as unknown as ChannelMessagesService,
    tenantMock as unknown as TenantContext,
    customersMock as unknown as CustomersService,
  );
}

describe("TicketChannelService", () => {
  let ticketsService: ReturnType<typeof buildTicketsServiceMock>;
  let channelMessagesService: ReturnType<typeof buildChannelMessagesServiceMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let customersService: ReturnType<typeof buildCustomersServiceMock>;
  let service: TicketChannelService;

  beforeEach(() => {
    vi.clearAllMocks();
    ticketsService = buildTicketsServiceMock();
    channelMessagesService = buildChannelMessagesServiceMock();
    tenantContext = buildTenantContextMock();
    customersService = buildCustomersServiceMock();
    service = createService(ticketsService, channelMessagesService, tenantContext, customersService);
  });

  describe("createAgentMessage", () => {
    it("verifies ticket access via getTicket, then creates an OUTBOUND message from the authenticated user", async () => {
      ticketsService.getTicket.mockResolvedValue({ id: "ticket-1" });
      channelMessagesService.createOutboundFromUser.mockResolvedValue({ id: "message-1" });

      const result = await service.createAgentMessage("ticket-1", "How can I help?");

      expect(ticketsService.getTicket).toHaveBeenCalledWith("ticket-1");
      expect(channelMessagesService.createOutboundFromUser).toHaveBeenCalledWith(
        "ticket-1",
        "LIVE_CHAT",
        "user-1",
        "How can I help?",
      );
      expect(result).toEqual({ id: "message-1" });
    });

    it("propagates a NotFoundException from getTicket for an out-of-scope ticket, never calling ChannelMessagesService", async () => {
      const notFound = new Error("Ticket not found");
      ticketsService.getTicket.mockRejectedValue(notFound);

      await expect(service.createAgentMessage("unknown", "body")).rejects.toThrow(notFound);
      expect(channelMessagesService.createOutboundFromUser).not.toHaveBeenCalled();
    });

    it("throws when no authenticated user exists on TenantContext", async () => {
      ticketsService.getTicket.mockResolvedValue({ id: "ticket-1" });
      tenantContext.userId = null;

      await expect(service.createAgentMessage("ticket-1", "body")).rejects.toThrow(
        "TenantContext: no authenticated user on this request",
      );
      expect(channelMessagesService.createOutboundFromUser).not.toHaveBeenCalled();
    });
  });

  // RM-15 — Email Adapter (Outbound).
  describe("createAgentEmailMessage", () => {
    it("verifies ticket access, resolves the contact's email, then enqueues an OUTBOUND EMAIL delivery from the authenticated user", async () => {
      ticketsService.getTicket.mockResolvedValue({
        id: "ticket-1",
        customerId: "customer-1",
        contactId: "contact-1",
      });
      customersService.getCustomer.mockResolvedValue({
        id: "customer-1",
        contacts: [{ id: "contact-1", email: "jane@example.com" }],
      });
      channelMessagesService.enqueueOutboundDelivery.mockResolvedValue({ id: "message-1" });

      const result = await service.createAgentEmailMessage("ticket-1", "Your invoice is attached.");

      expect(ticketsService.getTicket).toHaveBeenCalledWith("ticket-1");
      expect(customersService.getCustomer).toHaveBeenCalledWith("customer-1");
      expect(channelMessagesService.enqueueOutboundDelivery).toHaveBeenCalledWith(
        "ticket-1",
        "EMAIL",
        "user-1",
        "Your invoice is attached.",
      );
      expect(result).toEqual({ id: "message-1" });
    });

    it("propagates a NotFoundException from getTicket for an out-of-scope ticket, never resolving a contact or enqueueing", async () => {
      const notFound = new Error("Ticket not found");
      ticketsService.getTicket.mockRejectedValue(notFound);

      await expect(service.createAgentEmailMessage("unknown", "body")).rejects.toThrow(notFound);
      expect(customersService.getCustomer).not.toHaveBeenCalled();
      expect(channelMessagesService.enqueueOutboundDelivery).not.toHaveBeenCalled();
    });

    it("throws when no authenticated user exists on TenantContext", async () => {
      ticketsService.getTicket.mockResolvedValue({
        id: "ticket-1",
        customerId: "customer-1",
        contactId: "contact-1",
      });
      tenantContext.userId = null;

      await expect(service.createAgentEmailMessage("ticket-1", "body")).rejects.toThrow(
        "TenantContext: no authenticated user on this request",
      );
      expect(channelMessagesService.enqueueOutboundDelivery).not.toHaveBeenCalled();
    });

    it("rejects with a clear message when the ticket has no contact at all", async () => {
      ticketsService.getTicket.mockResolvedValue({
        id: "ticket-1",
        customerId: "customer-1",
        contactId: null,
      });

      await expect(service.createAgentEmailMessage("ticket-1", "body")).rejects.toThrow(
        "This ticket has no contact to email.",
      );
      expect(customersService.getCustomer).not.toHaveBeenCalled();
      expect(channelMessagesService.enqueueOutboundDelivery).not.toHaveBeenCalled();
    });

    it("rejects with a clear message when the ticket's contact has no email on file", async () => {
      ticketsService.getTicket.mockResolvedValue({
        id: "ticket-1",
        customerId: "customer-1",
        contactId: "contact-1",
      });
      customersService.getCustomer.mockResolvedValue({
        id: "customer-1",
        contacts: [{ id: "contact-1", email: null }],
      });

      await expect(service.createAgentEmailMessage("ticket-1", "body")).rejects.toThrow(
        "This ticket's contact has no email address on file.",
      );
      expect(channelMessagesService.enqueueOutboundDelivery).not.toHaveBeenCalled();
    });

    it("rejects when the ticket's contactId no longer matches any of the customer's contacts", async () => {
      ticketsService.getTicket.mockResolvedValue({
        id: "ticket-1",
        customerId: "customer-1",
        contactId: "contact-stale",
      });
      customersService.getCustomer.mockResolvedValue({
        id: "customer-1",
        contacts: [{ id: "contact-1", email: "jane@example.com" }],
      });

      await expect(service.createAgentEmailMessage("ticket-1", "body")).rejects.toThrow(
        "This ticket's contact has no email address on file.",
      );
      expect(channelMessagesService.enqueueOutboundDelivery).not.toHaveBeenCalled();
    });
  });

  describe("listMessagesForAgent", () => {
    it("verifies ticket access via getTicket, then lists messages", async () => {
      ticketsService.getTicket.mockResolvedValue({ id: "ticket-1" });
      channelMessagesService.listForTicket.mockResolvedValue([]);

      const result = await service.listMessagesForAgent("ticket-1");

      expect(ticketsService.getTicket).toHaveBeenCalledWith("ticket-1");
      expect(channelMessagesService.listForTicket).toHaveBeenCalledWith("ticket-1");
      expect(result).toEqual([]);
    });
  });

  describe("createCustomerMessage", () => {
    it("verifies ticket ownership via getTicketForCustomer, then creates an INBOUND message from the given contact", async () => {
      ticketsService.getTicketForCustomer.mockResolvedValue({ id: "ticket-1" });
      channelMessagesService.createInboundFromContact.mockResolvedValue({ id: "message-1" });

      const result = await service.createCustomerMessage(
        "ticket-1",
        "customer-1",
        "contact-1",
        "Hi, I need help",
      );

      expect(ticketsService.getTicketForCustomer).toHaveBeenCalledWith("ticket-1", "customer-1");
      expect(channelMessagesService.createInboundFromContact).toHaveBeenCalledWith(
        "ticket-1",
        "LIVE_CHAT",
        "contact-1",
        "Hi, I need help",
      );
      expect(result).toEqual({ id: "message-1" });
    });

    it("propagates a NotFoundException from getTicketForCustomer for another customer's ticket, never calling ChannelMessagesService", async () => {
      const notFound = new Error("Ticket not found");
      ticketsService.getTicketForCustomer.mockRejectedValue(notFound);

      await expect(
        service.createCustomerMessage("ticket-1", "customer-1", "contact-1", "body"),
      ).rejects.toThrow(notFound);
      expect(channelMessagesService.createInboundFromContact).not.toHaveBeenCalled();
    });
  });

  describe("listMessagesForCustomer", () => {
    it("verifies ticket ownership via getTicketForCustomer, then lists messages", async () => {
      ticketsService.getTicketForCustomer.mockResolvedValue({ id: "ticket-1" });
      channelMessagesService.listForTicket.mockResolvedValue([]);

      const result = await service.listMessagesForCustomer("ticket-1", "customer-1");

      expect(ticketsService.getTicketForCustomer).toHaveBeenCalledWith("ticket-1", "customer-1");
      expect(channelMessagesService.listForTicket).toHaveBeenCalledWith("ticket-1");
      expect(result).toEqual([]);
    });
  });

  // Story 85 — AI Chat: Escalate to a Human Ticket.
  describe("recordAiChatTranscript", () => {
    it("replays a CUSTOMER turn via createInboundFromContact and an ASSISTANT turn via createSystemMessage, in order", async () => {
      const messages: { role: "CUSTOMER" | "ASSISTANT"; body: string }[] = [
        { role: "CUSTOMER", body: "Cannot log in" },
        { role: "ASSISTANT", body: "Have you tried resetting your password?" },
      ];

      await service.recordAiChatTranscript("ticket-1", "contact-1", messages);

      expect(channelMessagesService.createInboundFromContact).toHaveBeenCalledWith(
        "ticket-1",
        "AI_CHAT",
        "contact-1",
        "Cannot log in",
      );
      expect(channelMessagesService.createSystemMessage).toHaveBeenCalledWith(
        "ticket-1",
        "AI_CHAT",
        "OUTBOUND",
        "Have you tried resetting your password?",
      );
    });

    it("does nothing for an empty transcript", async () => {
      await service.recordAiChatTranscript("ticket-1", "contact-1", []);

      expect(channelMessagesService.createInboundFromContact).not.toHaveBeenCalled();
      expect(channelMessagesService.createSystemMessage).not.toHaveBeenCalled();
    });

    it("never calls getTicket/getTicketForCustomer — no authorization check of its own", async () => {
      await service.recordAiChatTranscript("ticket-1", "contact-1", [
        { role: "CUSTOMER", body: "hi" },
      ]);

      expect(ticketsService.getTicket).not.toHaveBeenCalled();
      expect(ticketsService.getTicketForCustomer).not.toHaveBeenCalled();
    });
  });

  // Story 87 — Communication/Channels: Public Web-Form Ticket Intake.
  describe("recordWebFormMessage", () => {
    it("records an INBOUND WEB_FORM message via createInboundFromContact", async () => {
      channelMessagesService.createInboundFromContact.mockResolvedValue({ id: "message-1" });

      await service.recordWebFormMessage("ticket-1", "contact-1", "I need help with my order");

      expect(channelMessagesService.createInboundFromContact).toHaveBeenCalledWith(
        "ticket-1",
        "WEB_FORM",
        "contact-1",
        "I need help with my order",
      );
    });

    it("never calls getTicket/getTicketForCustomer — no authorization check of its own", async () => {
      await service.recordWebFormMessage("ticket-1", "contact-1", "body");

      expect(ticketsService.getTicket).not.toHaveBeenCalled();
      expect(ticketsService.getTicketForCustomer).not.toHaveBeenCalled();
    });
  });
});
