import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Job } from "bullmq";
import { WorkerModule } from "../src/worker.module";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  PortalNotificationEmailProcessor,
  type PortalNotificationEmailJobPayload,
} from "../src/queues/portal-notification-email.processor";

interface MailhogMessage {
  Content: { Headers: Record<string, string[]>; Body: string };
  To: Array<{ Mailbox: string; Domain: string }>;
}

async function fetchMailhogMessagesTo(recipientEmail: string): Promise<MailhogMessage[]> {
  const response = await fetch("http://localhost:8025/api/v2/messages?limit=50");
  const body = (await response.json()) as { items: MailhogMessage[] };
  return body.items.filter((item) => item.To.some((to) => `${to.Mailbox}@${to.Domain}` === recipientEmail));
}

/** Undoes quoted-printable's soft line-break (`=\r\n`/`=\n`, inserted to
 * keep every line under 76 chars) — nodemailer's default
 * `Content-Transfer-Encoding` for a body long enough to need one, which
 * can otherwise split a substring (confirmed empirically: it split this
 * suite's own UUID-bearing ticket subject mid-string). Real MIME clients
 * decode this the same way; a raw substring match against the wire
 * format would otherwise be asserting on an encoding artifact, not the
 * actual content. */
function unfoldQuotedPrintable(body: string): string {
  return body.replace(/=\r\n/g, "").replace(/=\n/g, "");
}

/**
 * RM-19 — Portal Email Notification Delivery. Real integration suite for
 * `PortalNotificationEmailProcessor`, against the real Mailhog SMTP
 * sandbox and real Postgres — mirrors `email-adapter.e2e-spec.ts`'s own
 * "direct Prisma fixture, no HTTP client, real Mailhog JSON-API
 * verification" convention exactly. Genuinely distinct from that suite:
 * this processor never touches `ChannelMessage` at all (see the
 * processor's own doc comment) — there is no `deliveryStatus` to assert
 * here, only that the right email reached the right address.
 */
describe("PortalNotificationEmailProcessor (e2e, via Mailhog)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let processor: PortalNotificationEmailProcessor;
  let branchId: string;
  let customerId: string;
  let contactId: string;
  let ticketId: string;
  let ticketSubject: string;
  const recipientEmail = `rm19-e2e-${randomUUID()}@example.test`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    processor = moduleRef.get(PortalNotificationEmailProcessor);

    const branch = await prisma.branch.findFirst();
    if (!branch) {
      throw new Error(
        "Expected a seeded branch to exist (run `pnpm --filter @crm/api prisma:seed` first)",
      );
    }
    branchId = branch.id;

    const customer = await prisma.customer.create({
      data: { branchId, displayName: `RM-19 e2e customer ${randomUUID()}` },
    });
    customerId = customer.id;

    // No `preferredLocale` — English, ASCII-only content. The Arabic copy
    // path is verified at the unit level instead
    // (`portal-notification-email.processor.spec.ts`, which asserts the
    // exact plain string passed to `sendMail` before any MIME encoding):
    // a non-ASCII subject/body gets RFC 2047/quoted-printable-encoded by
    // a real SMTP send, which would make a raw substring match against
    // Mailhog's own JSON API response fragile here for the wrong reason
    // (an encoding artifact, not a real assertion about content).
    const contact = await prisma.contact.create({
      data: { customerId, fullName: "RM-19 E2E Contact", email: recipientEmail },
    });
    contactId = contact.id;

    ticketSubject = `RM-19 e2e ticket ${randomUUID()}`;
    const ticket = await prisma.ticket.create({
      data: { branchId, customerId, contactId, subject: ticketSubject },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.ticket.delete({ where: { id: ticketId } });
    await prisma.contact.delete({ where: { id: contactId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await moduleRef.close();
  });

  it("sends a real notification email through Mailhog naming the ticket subject", async () => {
    const payload: PortalNotificationEmailJobPayload = { ticketId, eventType: "ticket.updated" };

    await processor.process({ data: payload } as Job<PortalNotificationEmailJobPayload>);

    const mailhogMessages = await fetchMailhogMessagesTo(recipientEmail);
    expect(mailhogMessages).toHaveLength(1);
    expect(mailhogMessages[0]?.Content.Headers["Subject"]?.[0]).toContain(ticketSubject);
    expect(unfoldQuotedPrintable(mailhogMessages[0]?.Content.Body ?? "")).toContain(ticketSubject);
  });
});
