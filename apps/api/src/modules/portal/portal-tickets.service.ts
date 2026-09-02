import { BadRequestException, Injectable } from "@nestjs/common";
import { TicketsService } from "../tickets/tickets.service";
import type {
  TicketCsatSummary,
  TicketHistoryEntrySummary,
  TicketSummary,
} from "../tickets/tickets.service";
import { TicketChannelService } from "../tickets/ticket-channel.service";
import type { ChannelMessageSummary } from "../channels/channel-messages.service";
import { AiChatService } from "../ai/ai-chat.service";
import { AttachmentsService } from "../attachments/attachments.service";
import type { AttachmentSummary, UploadedFile } from "../attachments/attachments.service";
import { PortalService } from "./portal.service";
import type { PortalCreateTicketDto } from "./dto/portal-create-ticket.dto";
import type { SubmitCsatDto } from "./dto/submit-csat.dto";
import type { CreateChannelMessageDto } from "../tickets/dto/create-channel-message.dto";

/** A ticket subject derived from a chat message is truncated, never
 * rejected — Story 85's own documented choice (Design decision 6): long
 * enough to be informative, short enough not to overflow existing
 * `TicketSummary` list-row layouts. */
const ESCALATION_SUBJECT_MAX_LENGTH = 120;

/**
 * Story 53 — composes `PortalService.getAuthenticatedContact` (resolves the
 * authenticated Contact's `customerId`, reusing its existing
 * portal-access-still-valid check) with `TicketsService`'s new
 * customer-scoped methods (see that service's own "Story 53" section) —
 * keeps `PortalTicketsController` thin and avoids duplicating
 * contact-resolution logic (plan Design item 6).
 *
 * Story 85 — also injects `AiChatService` (already exported by `AiModule`,
 * already imported by `PortalModule` for `PortalChatController`) so
 * `escalateChatSession` can compose it with `TicketsService`/
 * `TicketChannelService` — the orchestration lives here, not in
 * `AiChatService` itself, because `AiModule` cannot import `TicketsModule`
 * (which already imports `AiModule`; the reverse edge would be circular).
 */
@Injectable()
export class PortalTicketsService {
  constructor(
    private readonly portalService: PortalService,
    private readonly ticketsService: TicketsService,
    private readonly ticketChannelService: TicketChannelService,
    private readonly aiChatService: AiChatService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  /** `createTicketForContact` resolves the Contact (and its Customer/branch)
   * itself, so no separate resolution step is needed here. */
  createTicket(contactId: string, dto: PortalCreateTicketDto): Promise<TicketSummary> {
    return this.ticketsService.createTicketForContact(contactId, dto);
  }

  async listTickets(contactId: string): Promise<TicketSummary[]> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.listTicketsForCustomer(customerId);
  }

  async getTicket(contactId: string, ticketId: string): Promise<TicketSummary> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.getTicketForCustomer(ticketId, customerId);
  }

  async getTicketHistory(
    contactId: string,
    ticketId: string,
  ): Promise<TicketHistoryEntrySummary[]> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.getTicketHistoryForCustomer(ticketId, customerId);
  }

  /** Story 55 — feedback/CSAT for a resolved/closed ticket. */
  async submitCsat(
    contactId: string,
    ticketId: string,
    dto: SubmitCsatDto,
  ): Promise<{ id: string }> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.submitCsatForCustomer(ticketId, customerId, contactId, dto);
  }

  async getCsat(contactId: string, ticketId: string): Promise<TicketCsatSummary | null> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketsService.getCsatForCustomer(ticketId, customerId);
  }

  /**
   * Story 77 — Customer Portal Live Chat, the customer-facing half.
   * Composes `TicketChannelService`'s customer-scoped methods exactly the
   * way every other method here composes `TicketsService`'s own
   * customer-scoped ones — `contactId` doubles as the message's
   * `senderContactId`, `customerId` scopes ticket-ownership authorization.
   */
  async sendMessage(
    contactId: string,
    ticketId: string,
    dto: CreateChannelMessageDto,
  ): Promise<ChannelMessageSummary> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketChannelService.createCustomerMessage(ticketId, customerId, contactId, dto.body);
  }

  async getMessages(contactId: string, ticketId: string): Promise<ChannelMessageSummary[]> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.ticketChannelService.listMessagesForCustomer(ticketId, customerId);
  }

  /**
   * Story 103 — Customer Portal: Ticket Attachment Upload. Composes
   * `AttachmentsService`'s new customer-scoped methods exactly the way
   * `sendMessage`/`getMessages` above compose `TicketChannelService`'s own
   * — `contactId` doubles as the attachment's `uploadedByContactId`,
   * `customerId` scopes ticket-ownership authorization.
   */
  async uploadAttachment(
    contactId: string,
    ticketId: string,
    file: UploadedFile,
  ): Promise<AttachmentSummary> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.attachmentsService.uploadAttachmentForCustomer(
      ticketId,
      customerId,
      contactId,
      file,
    );
  }

  async listAttachments(contactId: string, ticketId: string): Promise<AttachmentSummary[]> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.attachmentsService.listAttachmentsForCustomer(ticketId, customerId);
  }

  async getAttachmentDownloadUrl(
    contactId: string,
    ticketId: string,
    attachmentId: string,
  ): Promise<string> {
    const { customerId } = await this.portalService.getAuthenticatedContact(contactId);
    return this.attachmentsService.getDownloadUrlForCustomer(ticketId, customerId, attachmentId);
  }

  /**
   * Story 85 — AI Chat: Escalate to a Human Ticket. Idempotent: an
   * already-escalated session returns its existing ticket id unchanged
   * rather than creating a duplicate (mirrors this codebase's existing
   * idempotent-retry convention, e.g. Story 79's PENDING-log handling,
   * CSAT's one-time-submission masking). A session with no messages yet
   * cannot be escalated — there is nothing meaningful to hand an agent.
   */
  async escalateChatSession(contactId: string, sessionId: string): Promise<{ ticketId: string }> {
    const context = await this.aiChatService.getEscalationContext(contactId, sessionId);
    if (context.escalatedTicketId) {
      return { ticketId: context.escalatedTicketId };
    }
    if (context.messages.length === 0) {
      throw new BadRequestException("Cannot escalate a chat session with no messages");
    }

    const firstCustomerMessage = context.messages.find((message) => message.role === "CUSTOMER");
    const subject = (firstCustomerMessage?.body ?? "AI chat escalation").slice(
      0,
      ESCALATION_SUBJECT_MAX_LENGTH,
    );

    const ticket = await this.ticketsService.createTicketForContact(contactId, { subject });
    await this.ticketChannelService.recordAiChatTranscript(ticket.id, contactId, context.messages);
    await this.aiChatService.recordEscalation(contactId, sessionId, ticket.id);
    return { ticketId: ticket.id };
  }
}
