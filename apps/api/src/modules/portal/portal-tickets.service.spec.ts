import { beforeEach, describe, expect, it, vi } from "vitest";
import { PortalTicketsService } from "./portal-tickets.service";
import type { PortalService } from "./portal.service";
import type { TicketsService } from "../tickets/tickets.service";
import type { TicketChannelService } from "../tickets/ticket-channel.service";

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
  };
}

describe("PortalTicketsService", () => {
  let portalService: ReturnType<typeof buildPortalServiceMock>;
  let ticketsService: ReturnType<typeof buildTicketsServiceMock>;
  let ticketChannelService: ReturnType<typeof buildTicketChannelServiceMock>;
  let service: PortalTicketsService;

  beforeEach(() => {
    vi.clearAllMocks();
    portalService = buildPortalServiceMock();
    ticketsService = buildTicketsServiceMock();
    ticketChannelService = buildTicketChannelServiceMock();
    service = new PortalTicketsService(
      portalService as unknown as PortalService,
      ticketsService as unknown as TicketsService,
      ticketChannelService as unknown as TicketChannelService,
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
});
