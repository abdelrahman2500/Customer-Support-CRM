import { Injectable, Logger } from "@nestjs/common";
import type { ChannelMessage } from "@prisma/client";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { PrismaService } from "../prisma/prisma.service";
import type { ChannelAdapter, ChannelAdapterSendResult, ParsedInboundMessage } from "./channel-adapter";

/** `ChannelsModule`'s factory constructs this only when both `SMTP_HOST`
 * and `SMTP_FROM` are present — see that module's own doc comment. */
export interface EmailAdapterConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

/**
 * RM-15 — the first real (non-first-party) `ChannelAdapter`: sends an
 * `OUTBOUND` `EMAIL` `ChannelMessage` over SMTP via `nodemailer` (MIT,
 * zero cost — no SendGrid/SES/Mailgun/Resend/Twilio or any paid
 * provider). Targets the already-running Mailhog sandbox in local
 * dev/CI (`docker-compose.yml`); a real production relay is a separate,
 * later product decision (`02-product-decisions.md` Decision Record 1)
 * this story does not make — see `ChannelsModule`'s own doc comment for
 * exactly how that stays true.
 *
 * `send(message)` does not trust anything the queue payload carried
 * beyond `message.ticketId` — `ChannelMessage` has no recipient/subject
 * field of its own (see `ChannelAdapter`'s own doc comment), so this
 * re-resolves the ticket's subject and its contact's email address
 * fresh, every send, directly via this app's own `PrismaService`
 * (mirrors every other worker processor's "own Prisma access, never an
 * API-side service call" convention). A ticket with no contact, or a
 * contact with no email on file, is a deterministic failure here — not a
 * crash — even though `TicketChannelService.createAgentEmailMessage`
 * already checked this at creation time: the two checks intentionally
 * overlap, because a contact's email can change (or the ticket's contact
 * can be reassigned) between when the message was created and when this
 * actually runs.
 *
 * Attachments are explicitly out of scope for this story (see the
 * completion report) — `send()` only ever builds a plain-text message
 * from `message.body`.
 */
@Injectable()
export class EmailAdapter implements ChannelAdapter {
  private readonly logger = new Logger(EmailAdapter.name);
  private readonly transporter: Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: EmailAdapterConfig,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    });
  }

  async send(message: ChannelMessage): Promise<ChannelAdapterSendResult> {
    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: message.ticketId },
      include: { contact: true },
    });
    const recipient = ticket.contact?.email;
    if (!recipient) {
      // Thrown, not logged-and-swallowed: this app's own
      // ChannelMessageDeliveryProcessor is what turns a thrown send()
      // into BullMQ's existing retry/FAILED handling — the same
      // contract every other rejection from this method already relies
      // on (a genuine SMTP failure below throws exactly the same way).
      throw new Error(`No recipient email address available for ticket ${message.ticketId}`);
    }

    const info = await this.transporter.sendMail({
      from: this.config.from,
      to: recipient,
      subject: ticket.subject,
      text: message.body,
    });
    this.logger.log(`Sent email for channel message ${message.id} to ${recipient}`);

    return { externalMessageId: info.messageId };
  }

  /** RM-16 (Email adapter — inbound) is what will actually implement
   * this; out of scope here — see `ChannelAdapter`'s own doc comment on
   * why the provisional shape is enough for the interface to compile. */
  parseInbound(_payload: unknown): ParsedInboundMessage | null {
    return null;
  }
}
