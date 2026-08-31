import { Injectable } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AiGatewayService } from "../ai/ai-gateway.service";
import type { AiCallResult, AiTicketInput } from "../ai/ai-provider.interface";
import { TicketsService } from "./tickets.service";

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
 * identically — a caller can never summarize/get-a-suggested-reply-for a
 * ticket they couldn't otherwise read.
 *
 * Story 74 — `suggestReplyForTicket` added the same way, reusing
 * `loadAiTicketInput` unchanged (additive-only service extension, this
 * codebase's own established convention).
 *
 * Story 75 — `categorizeTicket` added the same way. It only ever returns
 * a *suggested* category string in `AiCallResult.text` — nothing here
 * writes to `Ticket.category`. Auto-applying it would be a real product
 * decision (does it overwrite an agent's own choice? is it silently
 * applied or does it need explicit confirmation?) this story does not
 * make; an agent still applies it via the existing `PATCH /tickets/:id`
 * exactly like any other manual edit.
 */
@Injectable()
export class TicketAiService {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly tenantContext: TenantContext,
  ) {}

  async summarizeTicket(id: string): Promise<AiCallResult> {
    const input = await this.loadAiTicketInput(id);
    const { branchId } = this.tenantContext.requireBranchScope();
    return this.aiGatewayService.summarize(input, branchId);
  }

  async suggestReplyForTicket(id: string): Promise<AiCallResult> {
    const input = await this.loadAiTicketInput(id);
    const { branchId } = this.tenantContext.requireBranchScope();
    return this.aiGatewayService.suggestReply(input, branchId);
  }

  async categorizeTicket(id: string): Promise<AiCallResult> {
    const input = await this.loadAiTicketInput(id);
    const { branchId } = this.tenantContext.requireBranchScope();
    return this.aiGatewayService.categorize(input, branchId);
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
