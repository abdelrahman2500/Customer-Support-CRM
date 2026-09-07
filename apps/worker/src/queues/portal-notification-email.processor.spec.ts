import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { PortalNotificationEmailJobPayload } from "./portal-notification-email.processor";
import type { Job } from "bullmq";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransportMock };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

// Imported after the mock so the mocked module is what the processor sees.
import { PortalNotificationEmailProcessor } from "./portal-notification-email.processor";

function buildPrismaMock() {
  return {
    ticket: {
      findUnique: vi.fn(),
    },
  };
}

function buildConfigServiceMock(values: Record<string, unknown>) {
  return {
    get: vi.fn((key: string) => values[key]),
  };
}

const CONFIGURED_VALUES = {
  SMTP_HOST: "localhost",
  SMTP_PORT: 1025,
  SMTP_FROM: "support@example.test",
};

function createProcessor(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  configValues: Record<string, unknown>,
): PortalNotificationEmailProcessor {
  return new PortalNotificationEmailProcessor(
    prismaMock as unknown as PrismaService,
    buildConfigServiceMock(configValues) as never,
  );
}

function buildJob(data: PortalNotificationEmailJobPayload): Job<PortalNotificationEmailJobPayload> {
  return { data } as Job<PortalNotificationEmailJobPayload>;
}

const TICKET_WITH_CONTACT = {
  id: "ticket-1",
  subject: "Cannot log in",
  contact: { id: "contact-1", email: "jane@example.com", preferredLocale: null },
};

describe("PortalNotificationEmailProcessor", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    prisma = buildPrismaMock();
  });

  describe("process", () => {
    it("skips with a warning and never touches Prisma when SMTP isn't configured", async () => {
      const processor = createProcessor(prisma, {});
      const job = buildJob({ ticketId: "ticket-1", eventType: "ticket.updated" });

      await processor.process(job);

      expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("skips with a warning when the ticket has no contact with an email", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue({ ...TICKET_WITH_CONTACT, contact: null });
      const job = buildJob({ ticketId: "ticket-1", eventType: "ticket.updated" });

      await processor.process(job);

      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("sends an English ticket.updated email by default (no preferredLocale set)", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue(TICKET_WITH_CONTACT);
      const job = buildJob({ ticketId: "ticket-1", eventType: "ticket.updated" });

      await processor.process(job);

      expect(sendMailMock).toHaveBeenCalledWith({
        from: "support@example.test",
        to: "jane@example.com",
        subject: "Your ticket has been updated: Cannot log in",
        text: expect.stringContaining("Cannot log in"),
      });
    });

    it("sends a channel.message.created email with a different subject/body than ticket.updated", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue(TICKET_WITH_CONTACT);
      const job = buildJob({ ticketId: "ticket-1", eventType: "channel.message.created" });

      await processor.process(job);

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "New reply on your ticket: Cannot log in" }),
      );
    });

    it("sends the Arabic copy when the contact's preferredLocale is ar", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue({
        ...TICKET_WITH_CONTACT,
        contact: { ...TICKET_WITH_CONTACT.contact, preferredLocale: "ar" },
      });
      const job = buildJob({ ticketId: "ticket-1", eventType: "ticket.updated" });

      await processor.process(job);

      const call = sendMailMock.mock.calls[0]?.[0];
      expect(call.subject).toContain("تم تحديث تذكرتك");
    });

    it("never throws when the transport rejects — best-effort, no retry", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue(TICKET_WITH_CONTACT);
      sendMailMock.mockRejectedValue(new Error("connect ECONNREFUSED"));
      const job = buildJob({ ticketId: "ticket-1", eventType: "ticket.updated" });

      await expect(processor.process(job)).resolves.toBeUndefined();
    });

    it("configures the transport with auth when SMTP_USER/SMTP_PASSWORD are given", () => {
      createProcessor(prisma, { ...CONFIGURED_VALUES, SMTP_USER: "u", SMTP_PASSWORD: "p" });

      expect(createTransportMock).toHaveBeenCalledWith({
        host: "localhost",
        port: 1025,
        auth: { user: "u", pass: "p" },
      });
    });
  });
});
