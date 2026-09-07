import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ChannelMessage } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { EmailAdapterConfig } from "./email-adapter";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransportMock };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

// Imported after the mock so the mocked module is what the adapter sees.
import { EmailAdapter } from "./email-adapter";

function buildPrismaMock() {
  return {
    ticket: {
      findUniqueOrThrow: vi.fn(),
    },
  };
}

const CONFIG: EmailAdapterConfig = {
  host: "localhost",
  port: 1025,
  from: "support@example.test",
};

const MESSAGE = {
  id: "message-1",
  ticketId: "ticket-1",
  channelType: "EMAIL",
  direction: "OUTBOUND",
  senderContactId: null,
  senderUserId: "user-1",
  body: "Your invoice is attached.",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  deliveryStatus: "PENDING",
  externalMessageId: null,
  failureReason: null,
  retryCount: 0,
} as unknown as ChannelMessage;

const TICKET_WITH_CONTACT = {
  id: "ticket-1",
  subject: "Cannot log in",
  contact: { id: "contact-1", email: "jane@example.com" },
};

describe("EmailAdapter", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let adapter: EmailAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    prisma = buildPrismaMock();
    adapter = new EmailAdapter(prisma as unknown as PrismaService, CONFIG);
  });

  describe("send", () => {
    it("configures the transport from the given SMTP config, with auth omitted when no user/password given", () => {
      expect(createTransportMock).toHaveBeenCalledWith({
        host: "localhost",
        port: 1025,
        auth: undefined,
      });
    });

    it("configures the transport with auth when a user/password are given", () => {
      createTransportMock.mockClear();
      new EmailAdapter(prisma as unknown as PrismaService, { ...CONFIG, user: "u", password: "p" });

      expect(createTransportMock).toHaveBeenCalledWith({
        host: "localhost",
        port: 1025,
        auth: { user: "u", pass: "p" },
      });
    });

    it("resolves the recipient/subject fresh from the ticket, sends from the configured address with the message body, and returns the provider's messageId", async () => {
      prisma.ticket.findUniqueOrThrow.mockResolvedValue(TICKET_WITH_CONTACT);
      sendMailMock.mockResolvedValue({ messageId: "<abc@mailhog>" });

      const result = await adapter.send(MESSAGE);

      expect(prisma.ticket.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        include: { contact: true },
      });
      expect(sendMailMock).toHaveBeenCalledWith({
        from: "support@example.test",
        to: "jane@example.com",
        subject: "Cannot log in",
        text: "Your invoice is attached.",
      });
      expect(result).toEqual({ externalMessageId: "<abc@mailhog>" });
    });

    it("throws a deterministic error when the ticket has no contact at all", async () => {
      prisma.ticket.findUniqueOrThrow.mockResolvedValue({ ...TICKET_WITH_CONTACT, contact: null });

      await expect(adapter.send(MESSAGE)).rejects.toThrow(
        "No recipient email address available for ticket ticket-1",
      );
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("throws a deterministic error when the ticket's contact has no email on file", async () => {
      prisma.ticket.findUniqueOrThrow.mockResolvedValue({
        ...TICKET_WITH_CONTACT,
        contact: { id: "contact-1", email: null },
      });

      await expect(adapter.send(MESSAGE)).rejects.toThrow(
        "No recipient email address available for ticket ticket-1",
      );
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("propagates a transport-level rejection instead of catching it (BullMQ's own retry then applies)", async () => {
      prisma.ticket.findUniqueOrThrow.mockResolvedValue(TICKET_WITH_CONTACT);
      sendMailMock.mockRejectedValue(new Error("connect ECONNREFUSED"));

      await expect(adapter.send(MESSAGE)).rejects.toThrow("connect ECONNREFUSED");
    });
  });

  describe("parseInbound", () => {
    it("always returns null — RM-16 (inbound) is a separate, future story", () => {
      expect(adapter.parseInbound({ any: "payload" })).toBeNull();
      expect(adapter.parseInbound(undefined)).toBeNull();
    });
  });
});
