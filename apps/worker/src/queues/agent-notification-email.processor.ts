import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../env.validation";

/**
 * Must stay identical to `AGENT_NOTIFICATION_EMAIL_QUEUE` in
 * apps/api/src/queues/agent-notification-email.producer.ts.
 */
export const AGENT_NOTIFICATION_EMAIL_QUEUE = "agent-notification-email";

/** Must stay identical to `AgentNotificationEmailJobPayload` in
 * apps/api/src/queues/agent-notification-email.producer.ts. */
export type AgentNotificationEmailEventType = "sla.at_risk" | "ticket.escalated" | "ticket.mentioned";
export interface AgentNotificationEmailJobPayload {
  ticketId: string;
  eventType: AgentNotificationEmailEventType;
  recipientUserId: string;
}

interface EmailContent {
  subject: string;
  text: string;
}

/** English-only, unlike `PortalNotificationEmailProcessor`'s EN/AR table:
 * `User` has no `preferredLocale` column (only `Contact` does) — nothing
 * to key a locale choice off. A future story could add one without
 * changing anything else this file does. */
const EMAIL_CONTENT: Record<AgentNotificationEmailEventType, (ticketSubject: string) => EmailContent> = {
  "sla.at_risk": (ticketSubject) => ({
    subject: `Ticket approaching its SLA target: ${ticketSubject}`,
    text: `Your ticket "${ticketSubject}" is approaching its SLA target. Sign in to the workspace to review it.`,
  }),
  "ticket.escalated": (ticketSubject) => ({
    subject: `Ticket escalated: ${ticketSubject}`,
    text: `Your ticket "${ticketSubject}" has been escalated. Sign in to the workspace to review it.`,
  }),
  "ticket.mentioned": (ticketSubject) => ({
    subject: `You were mentioned on a ticket: ${ticketSubject}`,
    text: `You were mentioned in a note on ticket "${ticketSubject}". Sign in to the workspace to view it.`,
  }),
};

/**
 * RM-26 — Agent Email Notification Delivery. The agent-side mirror of
 * `PortalNotificationEmailProcessor` (RM-19) — same "best-effort, no
 * `ChannelMessage` row, no retry" reasoning applies unchanged: the in-app
 * notification this accompanies already exists and is authoritative, so a
 * lost email here is a non-event. Builds its own `Transporter` from the
 * same `SMTP_*` env vars every sibling email path already reads, rather
 * than sharing an instance — identical to `PortalNotificationEmailProcessor`'s
 * own doc comment on why that costs nothing.
 *
 * Re-resolves the recipient's email fresh via `recipientUserId` (never
 * trusts a stale queue-payload email address) and the ticket's subject
 * fresh via `ticketId` — but does NOT re-derive *who* the recipient is:
 * unlike the portal processor's `ticket.contactId` (a stable ticket
 * column), `ticket.mentioned`'s recipient is not something any ticket
 * column can answer, so the caller resolves it once and this processor
 * trusts that identity, exactly as it was resolved at the moment the
 * `NotificationLog` row was written.
 */
@Injectable()
@Processor(AGENT_NOTIFICATION_EMAIL_QUEUE)
export class AgentNotificationEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentNotificationEmailProcessor.name);
  private readonly transporter: Transporter | undefined;
  private readonly from: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvConfig, true>,
  ) {
    super();
    const host = config.get("SMTP_HOST", { infer: true });
    const from = config.get("SMTP_FROM", { infer: true });
    if (host && from) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get("SMTP_PORT", { infer: true }),
        auth: this.buildAuth(
          config.get("SMTP_USER", { infer: true }),
          config.get("SMTP_PASSWORD", { infer: true }),
        ),
      });
      this.from = from;
    }
  }

  async process(job: Job<AgentNotificationEmailJobPayload>): Promise<void> {
    if (!this.transporter || !this.from) {
      this.logger.warn(
        `No SMTP configured — skipping agent notification email for ticket ${job.data.ticketId}`,
      );
      return;
    }

    const [ticket, recipient] = await Promise.all([
      this.prisma.ticket.findUnique({
        where: { id: job.data.ticketId },
        select: { subject: true },
      }),
      this.prisma.user.findUnique({
        where: { id: job.data.recipientUserId },
        select: { email: true },
      }),
    ]);
    if (!ticket || !recipient) {
      this.logger.warn(
        `No ticket or recipient found for ticket ${job.data.ticketId} — skipping agent notification email`,
      );
      return;
    }

    const content = EMAIL_CONTENT[job.data.eventType](ticket.subject);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: recipient.email,
        subject: content.subject,
        text: content.text,
      });
      this.logger.log(
        `Sent agent notification email (${job.data.eventType}) for ticket ${job.data.ticketId}`,
      );
    } catch (error) {
      // Best-effort, never rethrown — see this class's own doc comment.
      this.logger.error(
        `Failed to send agent notification email for ticket ${job.data.ticketId}`,
        error as Error,
      );
    }
  }

  private buildAuth(
    user: string | undefined,
    password: string | undefined,
  ): { user: string; pass: string } | undefined {
    return user && password ? { user, pass: password } : undefined;
  }
}
