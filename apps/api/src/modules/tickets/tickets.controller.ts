import { Body, Controller, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { ListTicketsQueryDto } from "./dto/list-tickets-query.dto";
import { CreateTicketNoteDto } from "./dto/create-ticket-note.dto";
import { CreateChannelMessageDto } from "./dto/create-channel-message.dto";
import { TicketAiService } from "./ticket-ai.service";
import type { AiJobSubmittedResponse, AiResultResponse } from "./ticket-ai.service";
import { TicketChannelService } from "./ticket-channel.service";
import type { ChannelMessageSummary } from "../channels/channel-messages.service";
import type {
  TicketCsatSummary,
  TicketHistoryEntrySummary,
  TicketListItem,
  TicketNoteSummary,
  TicketSummary,
} from "./tickets.service";
import { TicketsService } from "./tickets.service";

@ApiTags("tickets")
@ApiBearerAuth()
@Controller("tickets")
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketAiService: TicketAiService,
    private readonly ticketChannelService: TicketChannelService,
  ) {}

  @Post()
  @RequirePermissions("ticket:create")
  create(@Body() dto: CreateTicketDto): Promise<TicketSummary> {
    return this.ticketsService.createTicket(dto);
  }

  @Get()
  @RequirePermissions("ticket:read")
  list(@Query() query: ListTicketsQueryDto): Promise<TicketListItem[]> {
    return this.ticketsService.listTickets(query);
  }

  @Get(":id")
  @RequirePermissions("ticket:read")
  getOne(@Param("id") id: string): Promise<TicketSummary> {
    return this.ticketsService.getTicket(id);
  }

  @Patch(":id")
  @RequirePermissions("ticket:update")
  update(@Param("id") id: string, @Body() dto: UpdateTicketDto): Promise<{ id: string }> {
    return this.ticketsService.updateTicket(id, dto);
  }

  @Get(":id/history")
  @RequirePermissions("ticket:read")
  getHistory(@Param("id") id: string): Promise<TicketHistoryEntrySummary[]> {
    return this.ticketsService.getTicketHistory(id);
  }

  @Post(":id/notes")
  @RequirePermissions("ticket:create")
  createNote(@Param("id") id: string, @Body() dto: CreateTicketNoteDto): Promise<{ id: string }> {
    return this.ticketsService.createTicketNote(id, dto);
  }

  @Get(":id/notes")
  @RequirePermissions("ticket:read")
  getNotes(@Param("id") id: string): Promise<TicketNoteSummary[]> {
    return this.ticketsService.getTicketNotes(id);
  }

  /**
   * `@Res()` (no `passthrough`) bypasses Nest's automatic reply — needed to
   * send a genuine `204 No Content` when no feedback has been submitted yet.
   * Returning `null` directly from a Nest handler still replies `200` with
   * an *empty* body (Nest's `isNil(body)` short-circuit in
   * `express-adapter.js`'s `reply()`), which every fetch client's
   * `response.json()` throws on — `204` is the only way to make "nothing
   * yet" distinguishable and safely parseable.
   */
  @Get(":id/csat")
  @RequirePermissions("ticket:read")
  async getCsat(@Param("id") id: string, @Res() response: Response): Promise<void> {
    const result: TicketCsatSummary | null = await this.ticketsService.getCsatForTicket(id);
    if (!result) {
      response.status(204).send();
      return;
    }
    response.status(200).json(result);
  }

  /**
   * Story 73 — advisory only: the response is never auto-applied to the
   * ticket (docs/architecture/07-sla-automation-and-ai.md: "Human review
   * is the default for agent-facing output"). Gated by `ticket:read`, not
   * a new permission — this reads the ticket's own content, it never
   * mutates it, so no caller gains anything beyond what `GET
   * /tickets/:id` already grants them.
   *
   * Story 76 — no longer executes the AI call synchronously: submits the
   * operation to `ai-processing` and returns the durable `AiPromptLog.id`
   * immediately (`{ id, outcome: "PENDING" }`) — see `TicketAiService`'s
   * own doc comment for the full architecture correction.
   */
  @Post(":id/ai/summarize")
  @RequirePermissions("ticket:read")
  summarize(@Param("id") id: string): Promise<AiJobSubmittedResponse> {
    return this.ticketAiService.summarizeTicket(id);
  }

  /** Story 74/76 — same advisory-only, `ticket:read`-gated, asynchronous
   * shape as `summarize` above. */
  @Post(":id/ai/suggest-reply")
  @RequirePermissions("ticket:read")
  suggestReply(@Param("id") id: string): Promise<AiJobSubmittedResponse> {
    return this.ticketAiService.suggestReplyForTicket(id);
  }

  /** Story 75/76 — same advisory-only, `ticket:read`-gated, asynchronous
   * shape as `summarize`/`suggestReply` above. Still only a *suggested*
   * category — never writes `Ticket.category` (see `TicketAiService`'s
   * own doc comment for why auto-applying it is out of scope). */
  @Post(":id/ai/categorize")
  @RequirePermissions("ticket:read")
  categorize(@Param("id") id: string): Promise<AiJobSubmittedResponse> {
    return this.ticketAiService.categorizeTicket(id);
  }

  /** Story 79 — retrieves the durable AiPromptLog row a prior
   * summarize/suggest-reply/categorize submission created, once
   * apps/worker has resolved it. ticket:read-gated, same as the three
   * submit routes above; masks cross-ticket access as 404 (see
   * TicketAiService.getAiResult's own doc comment). */
  @Get(":id/ai/:logId")
  @RequirePermissions("ticket:read")
  getAiResult(
    @Param("id") id: string,
    @Param("logId") logId: string,
  ): Promise<AiResultResponse> {
    return this.ticketAiService.getAiResult(id, logId);
  }

  /**
   * Story 77 — Customer Portal Live Chat, the agent-facing half. Gated by
   * `ticket:create` — mirrors `createNote`'s exact permission, since
   * sending a chat message adds ticket-visible content the same way a
   * note does. The created message is relayed into `ticket:{id}` by
   * `TicketRealtimeListener` (unchanged flow: REST write, realtime
   * fan-out) — this endpoint itself does not touch Socket.IO.
   */
  @Post(":id/messages")
  @RequirePermissions("ticket:create")
  sendMessage(
    @Param("id") id: string,
    @Body() dto: CreateChannelMessageDto,
  ): Promise<ChannelMessageSummary> {
    return this.ticketChannelService.createAgentMessage(id, dto.body);
  }

  @Get(":id/messages")
  @RequirePermissions("ticket:read")
  getMessages(@Param("id") id: string): Promise<ChannelMessageSummary[]> {
    return this.ticketChannelService.listMessagesForAgent(id);
  }
}
