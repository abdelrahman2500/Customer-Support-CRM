import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../env.validation";

/**
 * Must stay identical to `PORTAL_NOTIFICATION_EMAIL_QUEUE` in
 * apps/api/src/queues/portal-notification-email.producer.ts.
 */
export const PORTAL_NOTIFICATION_EMAIL_QUEUE = "portal-notification-email";

/** Must stay identical to `PortalNotificationEmailJobPayload` in
 * apps/api/src/queues/portal-notification-email.producer.ts. */
export type PortalNotificationEmailEventType = "ticket.updated" | "channel.message.created";
export interface PortalNotificationEmailJobPayload {
  ticketId: string;
  eventType: PortalNotificationEmailEventType;
}

const SUPPORTED_LOCALES = ["en", "ar"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

interface EmailContent {
  subject: string;
  text: string;
}

/** A small, self-contained EN/AR copy table — this repository's only two
 * configured locales (`apps/web/src/i18n/routing.ts`). Not pulled from
 * `NotificationTemplate` (Story 61, branch-admin-authored copy for a
 * different purpose): that model has no consumer anywhere in this
 * repository today, and wiring one up here — template resolution,
 * fallback-when-unconfigured, variable interpolation — would materially
 * expand this story well past "deliver a transactional notification
 * email." A future story can route this through `NotificationTemplate`
 * without changing anything else this file does. */
const EMAIL_CONTENT: Record<SupportedLocale, Record<PortalNotificationEmailEventType, (ticketSubject: string) => EmailContent>> = {
  en: {
    "ticket.updated": (ticketSubject) => ({
      subject: `Your ticket has been updated: ${ticketSubject}`,
      text: `There's an update on your support ticket "${ticketSubject}". Sign in to the portal to view it.`,
    }),
    "channel.message.created": (ticketSubject) => ({
      subject: `New reply on your ticket: ${ticketSubject}`,
      text: `You have a new reply on your support ticket "${ticketSubject}". Sign in to the portal to view it.`,
    }),
  },
  ar: {
    "ticket.updated": (ticketSubject) => ({
      subject: `تم تحديث تذكرتك: ${ticketSubject}`,
      text: `يوجد تحديث على تذكرة الدعم الخاصة بك "${ticketSubject}". سجّل الدخول إلى البوابة لعرضه.`,
    }),
    "channel.message.created": (ticketSubject) => ({
      subject: `رد جديد على تذكرتك: ${ticketSubject}`,
      text: `لديك رد جديد على تذكرة الدعم الخاصة بك "${ticketSubject}". سجّل الدخول إلى البوابة لعرضه.`,
    }),
  },
};

function resolveLocale(preferredLocale: string | null): SupportedLocale {
  return SUPPORTED_LOCALES.includes(preferredLocale as SupportedLocale) ? (preferredLocale as SupportedLocale) : "en";
}

/**
 * RM-19 — Portal Email Notification Delivery. Sends a best-effort,
 * one-way transactional email for a portal notification event
 * (`PortalNotificationLogListener`'s own two event types) — genuinely
 * distinct from `EmailAdapter`'s own `ChannelMessage`-lifecycle send
 * (RM-15): there is no `ChannelMessage` row for a notification email, no
 * `PENDING`/`SENT`/`FAILED` status anywhere to track it, and no retry —
 * the in-app/portal notification this accompanies already exists and is
 * authoritative, so losing this email to a transient SMTP failure is a
 * non-event, not a delivery failure a customer is depending on the way a
 * lost conversational reply would be (see `PortalNotificationEmailProducer`'s
 * own doc comment for the retry-policy side of this same reasoning).
 * Builds its own lightweight `Transporter` from the same `SMTP_HOST`/
 * `SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` env vars
 * `ChannelsModule`'s `EMAIL_ADAPTER` factory already reads, rather than
 * sharing that instance — `nodemailer` opens a fresh SMTP connection per
 * `sendMail` call by default (no connection pooling unless explicitly
 * enabled), so a second `Transporter` object has no real resource cost,
 * and keeps this file fully independent of `EmailAdapter`/RM-15's
 * already-shipped code.
 *
 * Re-resolves the recipient/subject/locale fresh from `ticketId` via this
 * app's own `PrismaService` — mirrors `EmailAdapter.send()`'s identical
 * "never trust stale queue-payload data" convention. No adapter registry
 * involved: this processor IS the whole "adapter" for this one-off,
 * non-conversational concern.
 */
@Injectable()
@Processor(PORTAL_NOTIFICATION_EMAIL_QUEUE)
export class PortalNotificationEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(PortalNotificationEmailProcessor.name);
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

  async process(job: Job<PortalNotificationEmailJobPayload>): Promise<void> {
    if (!this.transporter || !this.from) {
      this.logger.warn(
        `No SMTP configured — skipping notification email for ticket ${job.data.ticketId}`,
      );
      return;
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: job.data.ticketId },
      include: { contact: true },
    });
    const recipient = ticket?.contact?.email;
    if (!ticket || !recipient) {
      this.logger.warn(
        `No recipient email for ticket ${job.data.ticketId} — skipping notification email`,
      );
      return;
    }

    const locale = resolveLocale(ticket.contact?.preferredLocale ?? null);
    const content = EMAIL_CONTENT[locale][job.data.eventType](ticket.subject);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: recipient,
        subject: content.subject,
        text: content.text,
      });
      this.logger.log(
        `Sent portal notification email (${job.data.eventType}) for ticket ${job.data.ticketId}`,
      );
    } catch (error) {
      // Best-effort, never rethrown — no BullMQ retry, no Sentry: see this
      // class's own doc comment for why a lost notification email is not
      // treated with conversational-message severity.
      this.logger.error(
        `Failed to send portal notification email for ticket ${job.data.ticketId}`,
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
