import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { TicketStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

/**
 * PORTAL-1 — `GET /portal/tickets` takes query parameters for the first
 * time. A plain subclass rather than a bare `PaginationQueryDto` on the
 * controller because the global `ValidationPipe` runs with
 * `forbidNonWhitelisted`, so this is the one place a future "my tickets"
 * filter would have to be declared — mirrors `ListNotificationsQueryDto`'s
 * exact precedent and naming convention.
 *
 * Story 148 — that future arrived: `search` and `status` close the
 * findability gap this comment anticipated. Scope is still always the
 * caller's own Customer, resolved from the JWT
 * (`PortalTicketsController.list`), never from the request, and ordering is
 * still fixed — neither is expressible here, deliberately.
 *
 * Two fields, not `ListTicketsQueryDto`'s nine. The agent list filters by
 * priority, category id, assignee, unassigned-ness and customer, and sorts
 * three ways; none of those is a question a customer asks about their own
 * tickets, and several name concepts (assignee, department, triage
 * priority) the portal deliberately never shows. `statuses` (multi-select)
 * is left out for the same reason: the portal offers one status at a time.
 */
export class ListPortalTicketsQueryDto extends PaginationQueryDto {
  /**
   * Matches the ticket's subject or its category name, case-insensitively —
   * the same `searchWhereClause` the agent list uses, reused rather than
   * re-implemented. Both of those are things the customer either wrote or
   * is already shown; no internal-only field is searchable from here.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
