import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { AgentNotificationEmailJobPayload } from "./agent-notification-email.processor";
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
import { AgentNotificationEmailProcessor } from "./agent-notification-email.processor";

function buildPrismaMock() {
  return {
    ticket: {
      findUnique: vi.fn(),
    },
    user: {
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
): AgentNotificationEmailProcessor {
  return new AgentNotificationEmailProcessor(
    prismaMock as unknown as PrismaService,
    buildConfigServiceMock(configValues) as never,
  );
}

function buildJob(data: AgentNotificationEmailJobPayload): Job<AgentNotificationEmailJobPayload> {
  return { data } as Job<AgentNotificationEmailJobPayload>;
}

const TICKET = { id: "ticket-1", subject: "Cannot log in" };
const RECIPIENT = { id: "user-1", email: "agent@example.test" };

describe("AgentNotificationEmailProcessor", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    prisma = buildPrismaMock();
  });

  describe("process", () => {
    it("skips with a warning and never touches Prisma when SMTP isn't configured", async () => {
      const processor = createProcessor(prisma, {});
      const job = buildJob({
        ticketId: "ticket-1",
        eventType: "ticket.escalated",
        recipientUserId: "user-1",
      });

      await processor.process(job);

      expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("skips with a warning when the ticket cannot be found", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(RECIPIENT);
      const job = buildJob({
        ticketId: "ticket-1",
        eventType: "ticket.escalated",
        recipientUserId: "user-1",
      });

      await processor.process(job);

      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("skips with a warning when the recipient cannot be found", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue(TICKET);
      prisma.user.findUnique.mockResolvedValue(null);
      const job = buildJob({
        ticketId: "ticket-1",
        eventType: "ticket.escalated",
        recipientUserId: "user-1",
      });

      await processor.process(job);

      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it("sends a ticket.escalated email", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue(TICKET);
      prisma.user.findUnique.mockResolvedValue(RECIPIENT);
      const job = buildJob({
        ticketId: "ticket-1",
        eventType: "ticket.escalated",
        recipientUserId: "user-1",
      });

      await processor.process(job);

      expect(sendMailMock).toHaveBeenCalledWith({
        from: "support@example.test",
        to: "agent@example.test",
        subject: "Ticket escalated: Cannot log in",
        text: expect.stringContaining("Cannot log in"),
      });
    });

    it("sends a sla.at_risk email with a different subject/body than ticket.escalated", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue(TICKET);
      prisma.user.findUnique.mockResolvedValue(RECIPIENT);
      const job = buildJob({
        ticketId: "ticket-1",
        eventType: "sla.at_risk",
        recipientUserId: "user-1",
      });

      await processor.process(job);

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Ticket approaching its SLA target: Cannot log in" }),
      );
    });

    it("sends a ticket.mentioned email with a different subject/body than the other two", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue(TICKET);
      prisma.user.findUnique.mockResolvedValue(RECIPIENT);
      const job = buildJob({
        ticketId: "ticket-1",
        eventType: "ticket.mentioned",
        recipientUserId: "user-1",
      });

      await processor.process(job);

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "You were mentioned on a ticket: Cannot log in" }),
      );
    });

    it("never throws when the transport rejects — best-effort, no retry", async () => {
      const processor = createProcessor(prisma, CONFIGURED_VALUES);
      prisma.ticket.findUnique.mockResolvedValue(TICKET);
      prisma.user.findUnique.mockResolvedValue(RECIPIENT);
      sendMailMock.mockRejectedValue(new Error("connect ECONNREFUSED"));
      const job = buildJob({
        ticketId: "ticket-1",
        eventType: "ticket.escalated",
        recipientUserId: "user-1",
      });

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
