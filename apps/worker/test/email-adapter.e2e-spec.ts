import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Job, Queue } from "bullmq";
import { WorkerModule } from "../src/worker.module";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  ChannelMessageDeliveryProcessor,
  type ChannelMessageDeliveryJobPayload,
} from "../src/queues/channel-message-delivery.processor";
import {
  CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE,
  type ChannelMessageDeliveryOutcomeJobPayload,
} from "../src/queues/channel-message-delivery-events.types";

interface MailhogMessage {
  Content: { Headers: Record<string, string[]>; Body: string };
  To: Array<{ Mailbox: string; Domain: string }>;
}

async function fetchMailhogMessagesTo(recipientEmail: string): Promise<MailhogMessage[]> {
  const response = await fetch("http://localhost:8025/api/v2/messages?limit=50");
  const body = (await response.json()) as { items: MailhogMessage[] };
  return body.items.filter((item) => item.To.some((to) => `${to.Mailbox}@${to.Domain}` === recipientEmail));
}

/**
 * RM-15 — Email Adapter (Outbound). Real integration suite for
 * `EmailAdapter`, against the real Mailhog SMTP sandbox
 * (`docker-compose.yml`) and real Postgres/Redis — a genuine,
 * non-mocked proof of delivery, mirroring this story's own acceptance
 * criterion ("verifiable in Mailhog"). Mirrors
 * `sla-timer.processor.e2e-spec.ts`'s exact "direct Prisma fixture, no
 * HTTP client" convention — `apps/worker` has no HTTP surface of its
 * own.
 *
 * Requires `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` to actually be set (this
 * suite's own `apps/worker/.env`, gitignored, points them at Mailhog's
 * `1025`) — without them `ChannelAdapterRegistry.resolve("EMAIL")`
 * returns `undefined` and this suite's own first assertion fails with a
 * clear "not registered" message rather than silently no-op'ing.
 */
describe("EmailAdapter (e2e, via Mailhog)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let processor: ChannelMessageDeliveryProcessor;
  let handbackQueue: Queue<ChannelMessageDeliveryOutcomeJobPayload>;
  let branchId: string;
  let customerId: string;
  let contactId: string;
  let ticketId: string;
  let ticketSubject: string;
  const recipientEmail = `rm15-e2e-${randomUUID()}@example.test`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    processor = moduleRef.get(ChannelMessageDeliveryProcessor);
    handbackQueue = moduleRef.get(getQueueToken(CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE));

    const branch = await prisma.branch.findFirst();
    if (!branch) {
      throw new Error(
        "Expected a seeded branch to exist (run `pnpm --filter @crm/api prisma:seed` first)",
      );
    }
    branchId = branch.id;

    const customer = await prisma.customer.create({
      data: { branchId, displayName: `RM-15 e2e customer ${randomUUID()}` },
    });
    customerId = customer.id;

    const contact = await prisma.contact.create({
      data: { customerId, fullName: "RM-15 E2E Contact", email: recipientEmail },
    });
    contactId = contact.id;

    ticketSubject = `RM-15 e2e ticket ${randomUUID()}`;
    const ticket = await prisma.ticket.create({
      data: { branchId, customerId, contactId, subject: ticketSubject },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.channelMessage.deleteMany({ where: { ticketId } });
    await prisma.ticket.delete({ where: { id: ticketId } });
    await prisma.contact.delete({ where: { id: contactId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await moduleRef.close();
  });

  it(
    "sends a real email through Mailhog with the ticket's subject/the contact's address/the message body, " +
      "marks the row SENT with a real externalMessageId, hands back delivery-sent, and never sends a " +
      "duplicate when the same job is processed again afterward",
    async () => {
      const bodyMarker = `RM-15 e2e body ${randomUUID()}`;
      const message = await prisma.channelMessage.create({
        data: {
          ticketId,
          channelType: "EMAIL",
          direction: "OUTBOUND",
          body: bodyMarker,
          deliveryStatus: "PENDING",
        },
      });

      const payload: ChannelMessageDeliveryJobPayload = {
        channelMessageId: message.id,
        ticketId,
        channelType: "EMAIL",
        body: message.body,
      };

      await processor.process({ data: payload } as Job<ChannelMessageDeliveryJobPayload>);

      const updated = await prisma.channelMessage.findUniqueOrThrow({ where: { id: message.id } });
      expect(updated.deliveryStatus).toBe("SENT");
      expect(updated.externalMessageId).toBeTruthy();

      const handbackJobs = (await handbackQueue.getJobs(["waiting", "delayed", "completed"])).filter(
        (job) => job.data.message.id === message.id,
      );
      expect(handbackJobs).toHaveLength(1);
      expect(handbackJobs[0]?.data.message.deliveryStatus).toBe("SENT");

      // Genuine, non-mocked proof: query Mailhog's own JSON API for the
      // message it actually received.
      const mailhogMessages = await fetchMailhogMessagesTo(recipientEmail);
      expect(mailhogMessages).toHaveLength(1);
      expect(mailhogMessages[0]?.Content.Headers["Subject"]?.[0]).toBe(ticketSubject);
      expect(mailhogMessages[0]?.Content.Body).toContain(bodyMarker);

      // Idempotency guard: processing the same job again after the row
      // is already SENT must not send a second email.
      await processor.process({ data: payload } as Job<ChannelMessageDeliveryJobPayload>);
      const mailhogMessagesAfterSecondRun = await fetchMailhogMessagesTo(recipientEmail);
      expect(mailhogMessagesAfterSecondRun).toHaveLength(1);

      await Promise.all(handbackJobs.map((job) => job.remove()));
    },
  );
});
