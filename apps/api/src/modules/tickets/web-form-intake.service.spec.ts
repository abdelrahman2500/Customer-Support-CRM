import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebFormIntakeService } from "./web-form-intake.service";
import type { CustomersService } from "../customers/customers.service";
import type { TicketsService } from "./tickets.service";
import type { TicketChannelService } from "./ticket-channel.service";

function buildCustomersServiceMock() {
  return { findOrCreateContactForWebForm: vi.fn() };
}

function buildTicketsServiceMock() {
  return { createTicketForContact: vi.fn() };
}

function buildTicketChannelServiceMock() {
  return { recordWebFormMessage: vi.fn() };
}

function createService(
  customersMock: ReturnType<typeof buildCustomersServiceMock>,
  ticketsMock: ReturnType<typeof buildTicketsServiceMock>,
  ticketChannelMock: ReturnType<typeof buildTicketChannelServiceMock>,
): WebFormIntakeService {
  return new WebFormIntakeService(
    customersMock as unknown as CustomersService,
    ticketsMock as unknown as TicketsService,
    ticketChannelMock as unknown as TicketChannelService,
  );
}

describe("WebFormIntakeService", () => {
  let customersService: ReturnType<typeof buildCustomersServiceMock>;
  let ticketsService: ReturnType<typeof buildTicketsServiceMock>;
  let ticketChannelService: ReturnType<typeof buildTicketChannelServiceMock>;
  let service: WebFormIntakeService;

  beforeEach(() => {
    vi.clearAllMocks();
    customersService = buildCustomersServiceMock();
    ticketsService = buildTicketsServiceMock();
    ticketChannelService = buildTicketChannelServiceMock();
    service = createService(customersService, ticketsService, ticketChannelService);
  });

  describe("submit", () => {
    const dto = {
      branchId: "branch-1",
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "555-0100",
      subject: "Cannot log in",
      category: "account",
      message: "I keep getting an invalid password error",
    };

    it("resolves the contact, creates the ticket, records the message, and returns the ticket", async () => {
      customersService.findOrCreateContactForWebForm.mockResolvedValue({
        customerId: "customer-1",
        contactId: "contact-1",
      });
      const ticket = {
        id: "ticket-1",
        subject: "Cannot log in",
        category: "account",
        status: "OPEN",
        customerId: "customer-1",
        contactId: "contact-1",
      };
      ticketsService.createTicketForContact.mockResolvedValue(ticket);
      ticketChannelService.recordWebFormMessage.mockResolvedValue(undefined);

      const result = await service.submit(dto);

      expect(customersService.findOrCreateContactForWebForm).toHaveBeenCalledWith("branch-1", {
        fullName: "Jane Doe",
        email: "jane@example.com",
        phone: "555-0100",
      });
      expect(ticketsService.createTicketForContact).toHaveBeenCalledWith("contact-1", {
        subject: "Cannot log in",
        category: "account",
      });
      expect(ticketChannelService.recordWebFormMessage).toHaveBeenCalledWith(
        "ticket-1",
        "contact-1",
        "I keep getting an invalid password error",
      );
      expect(result).toBe(ticket);
    });

    it("calls the three collaborators in order", async () => {
      const order: string[] = [];
      customersService.findOrCreateContactForWebForm.mockImplementation(async () => {
        order.push("findOrCreateContact");
        return { customerId: "customer-1", contactId: "contact-1" };
      });
      ticketsService.createTicketForContact.mockImplementation(async () => {
        order.push("createTicket");
        return { id: "ticket-1" };
      });
      ticketChannelService.recordWebFormMessage.mockImplementation(async () => {
        order.push("recordMessage");
      });

      await service.submit(dto);

      expect(order).toEqual(["findOrCreateContact", "createTicket", "recordMessage"]);
    });

    it("propagates a NotFoundException from an unknown branch, never creating a ticket or message", async () => {
      const notFound = new Error("Branch not found");
      customersService.findOrCreateContactForWebForm.mockRejectedValue(notFound);

      await expect(service.submit(dto)).rejects.toThrow(notFound);
      expect(ticketsService.createTicketForContact).not.toHaveBeenCalled();
      expect(ticketChannelService.recordWebFormMessage).not.toHaveBeenCalled();
    });
  });
});
