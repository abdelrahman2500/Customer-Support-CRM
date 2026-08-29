import { beforeEach, describe, expect, it, vi } from "vitest";
import { PortalTicketsService } from "./portal-tickets.service";
import type { PortalService } from "./portal.service";
import type { TicketsService } from "../tickets/tickets.service";

function buildPortalServiceMock() {
  return { getAuthenticatedContact: vi.fn() };
}

function buildTicketsServiceMock() {
  return {
    createTicketForContact: vi.fn(),
    listTicketsForCustomer: vi.fn(),
    getTicketForCustomer: vi.fn(),
    getTicketHistoryForCustomer: vi.fn(),
  };
}

describe("PortalTicketsService", () => {
  let portalService: ReturnType<typeof buildPortalServiceMock>;
  let ticketsService: ReturnType<typeof buildTicketsServiceMock>;
  let service: PortalTicketsService;

  beforeEach(() => {
    vi.clearAllMocks();
    portalService = buildPortalServiceMock();
    ticketsService = buildTicketsServiceMock();
    service = new PortalTicketsService(
      portalService as unknown as PortalService,
      ticketsService as unknown as TicketsService,
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
});
