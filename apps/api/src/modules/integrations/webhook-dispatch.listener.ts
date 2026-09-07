import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { WebhookDispatchProducer } from "../../queues/webhook-dispatch.producer";
import {
  TICKET_CREATED_EVENT,
  TICKET_ESCALATED_EVENT,
  TICKET_UPDATED_EVENT,
  type TicketCreatedEvent,
  type TicketEscalatedEvent,
  type TicketUpdatedEvent,
} from "../tickets/tickets.events";
import {
  SLA_AT_RISK_EVENT,
  SLA_BREACHED_EVENT,
  type SlaAtRiskEvent,
  type SlaBreachedEvent,
} from "../sla-policies/sla-detection.events";
import {
  CHANNEL_MESSAGE_CREATED_EVENT,
  type ChannelMessageCreatedEvent,
} from "../channels/channel-messages.events";
import type { WebhookEventType } from "./webhook-event-types";

/**
 * RM-20 — the generic outbound-dispatch listener: the only place this
 * story's `WEBHOOK_EVENT_TYPES` are actually turned into enqueued jobs.
 * Mirrors `PortalNotificationLogListener`'s exact "in-process
 * `@OnEvent` handler, best-effort, never rethrows" shape — a webhook target
 * an admin configured is even less trustworthy than an SMTP relay, so a
 * broken/unreachable target must never be able to affect the ticket
 * mutation that triggered it.
 *
 * `apps/nestjs/event-emitter`'s `EventEmitterModule.forRoot()` runs without
 * `wildcard: true` in this application (`app.module.ts`), so there is no
 * single subscription that could "listen broadly" — each curated event
 * type gets its own `@OnEvent` handler here instead, all funnelling into
 * the shared `dispatch()`.
 */
@Injectable()
export class WebhookDispatchListener {
  private readonly logger = new Logger(WebhookDispatchListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookDispatchProducer: WebhookDispatchProducer,
  ) {}

  @OnEvent(TICKET_CREATED_EVENT)
  async onTicketCreated(event: TicketCreatedEvent): Promise<void> {
    await this.dispatchForTicket("ticket.created", event.ticket.id);
  }

  @OnEvent(TICKET_UPDATED_EVENT)
  async onTicketUpdated(event: TicketUpdatedEvent): Promise<void> {
    await this.dispatchForTicket("ticket.updated", event.ticket.id);
  }

  @OnEvent(TICKET_ESCALATED_EVENT)
  async onTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    await this.dispatchForTicket("ticket.escalated", event.ticket.id);
  }

  @OnEvent(SLA_AT_RISK_EVENT)
  async onSlaAtRisk(event: SlaAtRiskEvent): Promise<void> {
    await this.dispatch("sla.at_risk", event.branchId, event.ticketId);
  }

  @OnEvent(SLA_BREACHED_EVENT)
  async onSlaBreached(event: SlaBreachedEvent): Promise<void> {
    await this.dispatch("sla.breached", event.branchId, event.ticketId);
  }

  @OnEvent(CHANNEL_MESSAGE_CREATED_EVENT)
  async onChannelMessageCreated(event: ChannelMessageCreatedEvent): Promise<void> {
    await this.dispatchForTicket("channel.message.created", event.ticketId);
  }

  /** `TicketSummary`/`ChannelMessageCreatedEvent` carry no `branchId` of
   * their own (unlike the SLA events, which already do) — one extra lookup
   * resolves it, mirroring `PortalNotificationLogListener.
   * onChannelMessageCreated`'s own `prisma.ticket.findUnique` precedent. */
  private async dispatchForTicket(eventType: WebhookEventType, ticketId: string): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { branchId: true },
      });
      if (!ticket) {
        return;
      }
      await this.dispatch(eventType, ticket.branchId, ticketId);
    } catch (error) {
      this.logger.error(
        `Failed to dispatch webhook event ${eventType} for ticket ${ticketId}`,
        error as Error,
      );
    }
  }

  private async dispatch(eventType: WebhookEventType, branchId: string, ticketId: string): Promise<void> {
    try {
      const subscriptions = await this.prisma.webhookSubscription.findMany({
        where: { branchId, isActive: true, subscribedEventTypes: { has: eventType } },
      });
      for (const subscription of subscriptions) {
        await this.webhookDispatchProducer.enqueue({ subscriptionId: subscription.id, eventType, ticketId });
      }
    } catch (error) {
      this.logger.error(
        `Failed to dispatch webhook event ${eventType} for ticket ${ticketId}`,
        error as Error,
      );
    }
  }
}
