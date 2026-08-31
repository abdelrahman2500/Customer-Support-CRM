import { Injectable } from "@nestjs/common";
import type { AiFeature } from "@prisma/client";
import type { AiTicketInput } from "@crm/ai";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AiGatewayService, promptRef } from "../ai/ai-gateway.service";
import { AiProcessingProducer } from "../../queues/ai-processing.producer";
import { TicketsService } from "./tickets.service";

/** The immediate response every `/tickets/:id/ai/*` route now returns —
 * see this file's own Story 76 doc comment. Never a raw BullMQ job id:
 * the durable `AiPromptLog.id` is the one identifier a caller needs. */
export interface AiJobSubmittedResponse {
  id: string;
  outcome: "PENDING";
}

/** The three ticket-scoped AI features this service submits — deliberately
 * narrower than the full `AiFeature` Prisma enum (`CHAT` has no producer
 * here; chatbot is out of scope, see the plan's own Non-goals). */
type TicketAiFeature = "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE";

/**
 * Story 73 — the first real consumer of `AiGatewayService` (Story 72's own
 * foundation). Composes the already-exported `TicketsService` with
 * `AiGatewayService` exactly the way `PortalTicketsService` composes
 * `TicketsService` with `PortalService` (`portal-tickets.service.ts`'s own
 * doc comment) — `TicketsModule` imports `AiModule` for this (mirrors
 * `PortalModule` importing `TicketsModule`/`KnowledgeBaseModule`).
 *
 * `Ticket` has no free-text "body"/"description" field in this schema
 * (only `subject`) — the only substantive ticket-scoped free text is its
 * `TicketNote`s. `loadAiTicketInput` uses `subject` + every note's `body`,
 * chronologically joined, as the ticket's actual textual content per this
 * domain model today, rather than inventing a new field. A ticket with no
 * notes yet still summarizes/categorizes/suggests-a-reply-for correctly
 * (an empty `body` is a valid, if less useful, input).
 *
 * Every method here reuses `TicketsService.getTicket`/`getTicketNotes`,
 * so branch scope and Story 68's department-visibility filter apply
 * identically — a caller can never submit an AI operation for a ticket
 * they couldn't otherwise read.
 *
 * Story 74/75 — `suggestReplyForTicket`/`categorizeTicket` added the same
 * way, reusing `loadAiTicketInput` unchanged (additive-only service
 * extension, this codebase's own established convention). `categorizeTicket`
 * only ever returns a *suggested* category — nothing here writes to
 * `Ticket.category`; an agent applies it via the existing
 * `PATCH /tickets/:id` exactly like any other manual edit.
 *
 * Story 76 — architecture correction: each method used to `await` a
 * synchronous `AiGatewayService.summarize/suggestReply/categorize` call
 * (which itself called the AI provider) inside the HTTP request — this
 * violated docs/architecture/02-system-architecture-overview.md's
 * Boundary rule 2. Every method now creates a durable `AiPromptLog` row
 * (`AiGatewayService.createPendingLog`) and enqueues `ai-processing`
 * (`AiProcessingProducer`) instead — `apps/worker`'s `AiProcessingProcessor`
 * performs the actual call. Ticket authorization/loading
 * (`loadAiTicketInput`) still runs synchronously here, unchanged — only
 * internal, already-fast DB reads, not "slow external work."
 */
@Injectable()
export class TicketAiService {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly aiProcessingProducer: AiProcessingProducer,
    private readonly tenantContext: TenantContext,
  ) {}

  async summarizeTicket(id: string): Promise<AiJobSubmittedResponse> {
    return this.submit(id, "SUMMARIZE");
  }

  async suggestReplyForTicket(id: string): Promise<AiJobSubmittedResponse> {
    return this.submit(id, "SUGGEST_REPLY");
  }

  async categorizeTicket(id: string): Promise<AiJobSubmittedResponse> {
    return this.submit(id, "CATEGORIZE");
  }

  private async submit(id: string, feature: TicketAiFeature): Promise<AiJobSubmittedResponse> {
    const input = await this.loadAiTicketInput(id);
    const { branchId } = this.tenantContext.requireBranchScope();

    const log = await this.aiGatewayService.createPendingLog(
      feature as AiFeature,
      branchId,
      promptRef(input.subject, input.body),
    );

    await this.aiProcessingProducer.enqueue({
      aiPromptLogId: log.id,
      ticketId: id,
      branchId,
      feature,
      subject: input.subject,
      body: input.body,
    });

    return { id: log.id, outcome: "PENDING" };
  }

  private async loadAiTicketInput(id: string): Promise<AiTicketInput> {
    const ticket = await this.ticketsService.getTicket(id);
    const notes = await this.ticketsService.getTicketNotes(id);
    return {
      subject: ticket.subject,
      body: notes.map((note) => note.body).join("\n\n"),
    };
  }
}
