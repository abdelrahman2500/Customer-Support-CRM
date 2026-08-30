import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { TicketPriority, TicketStatus } from "@prisma/client";

/**
 * Story 23 — mechanical, same-response-shape extension of `GET /tickets`:
 * equality filters on already-existing scalar `Ticket` fields, plus a
 * sort choice on the two timestamp columns Story 23 also exposes on
 * `TicketSummary` for the first time (see `tickets.service.ts`). No
 * pagination — no precedent anywhere in this codebase to extend, and
 * inventing one is explicitly out of scope for this story.
 *
 * Story 70 — `search` closes the gap this DTO's own doc comment used to
 * disclose ("No search... inventing one is out of scope"), now that
 * Story 64 established the precedent for this codebase's first
 * search-query-param (`ListArticlesQueryDto`). Matches `subject` or
 * `category` via the same plain `contains`/`mode: "insensitive"` filter,
 * not `tsvector` — see `tickets.service.ts`'s own doc comment for why.
 */
export class ListTicketsQueryDto {
  @ApiProperty({ required: false, enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: ["createdAt", "updatedAt"] })
  @IsOptional()
  @IsIn(["createdAt", "updatedAt"])
  sortBy?: "createdAt" | "updatedAt";

  @ApiProperty({ required: false, enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
