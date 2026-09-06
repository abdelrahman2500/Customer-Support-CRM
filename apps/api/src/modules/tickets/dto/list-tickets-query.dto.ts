import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { TicketPriority, TicketStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

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
 * category name via the same plain `contains`/`mode: "insensitive"`
 * filter, not `tsvector` — see `tickets.service.ts`'s own doc comment for
 * why.
 *
 * Story 120 — `category` (free text) replaced by `categoryId` (exact-id
 * equality filter), mirroring `Ticket.category`'s own schema change.
 *
 * Story S-8e — `page`/`pageSize` finally close the gap this DTO's own
 * Story 23 comment opened ("No pagination — no precedent anywhere in this
 * codebase to extend"). That precedent now exists: `PaginationQueryDto`
 * and the `paginate` helper (Story S-8a), already carrying audit logs,
 * notifications and the knowledge base. Composed with `IntersectionType`
 * for the same reason `ListAuditLogsQueryDto` does — it copies both
 * classes' validation and Swagger metadata, and this class has its own
 * long-standing filter set to keep.
 */
export class ListTicketsQueryDto extends IntersectionType(PaginationQueryDto) {
  @ApiProperty({ required: false, enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  /**
   * Story S-9 — match any of several statuses (`?statuses=OPEN&statuses=IN_PROGRESS`).
   *
   * The dashboard's panels mean "still needs work", which is two statuses,
   * and they used to express that by filtering the fetched rows in the
   * browser. That was survivable while they ordered client-side too, but
   * it cannot survive `sortBy=slaUrgency`: an SLA target outlives the
   * ticket being resolved (`SlaTargetListener` only deletes a target on
   * recategorization with no matching policy, never on resolution), so a
   * long-since-resolved ticket sorts as maximally urgent and would fill
   * the page ahead of open work that is actually breaching.
   *
   * A generic multi-value filter rather than an `openOnly` flag: which
   * statuses count as "needs work" stays the screen's own definition
   * (Story 28's `OPEN_STATUSES`), and only the mechanism moves here.
   *
   * A single-valued query string arrives as a bare string, so it is
   * normalized to an array before `each` validation runs.
   */
  @ApiProperty({ required: false, isArray: true, enum: TicketStatus })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsEnum(TicketStatus, { each: true })
  statuses?: TicketStatus[];

  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  /**
   * Story S-8d — narrow to one customer's tickets server-side.
   *
   * `CustomerDetailView` previously fetched the branch-wide list and
   * filtered it in the browser, which meant a customer whose tickets fell
   * outside the capped window appeared to have none. Asking the server the
   * question the screen actually has fixes that, and is what lets
   * `GET /tickets` be paginated without the screen breaking further.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  /**
   * Story S-8d — tickets with no assignee.
   *
   * A separate flag rather than `assignedToUserId=null`, because that
   * field is a `@IsUUID()` equality filter and a query string cannot carry
   * a real null. Same validated-string-literal shape
   * `ListCustomersQueryDto.isActive` already uses for the same reason.
   *
   * The dashboard's "unclaimed" panel used to filter client-side over the
   * newest 500 tickets, so an *older* unclaimed ticket — precisely the one
   * most needing attention — could never appear.
   */
  @ApiProperty({ required: false, enum: ["true", "false"] })
  @IsOptional()
  @IsIn(["true", "false"])
  unassigned?: "true" | "false";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Story S-9 — `slaUrgency` orders by the ticket's governing SLA target,
   * soonest first, with tickets that have no target last.
   *
   * This is the ordering the dashboard's panels always wanted and used to
   * compute in the browser from each row's embedded `slaTarget`. It is
   * expressible as a plain relation sort because a policy can no longer
   * resolve before it responds (see `SlaPoliciesService.assertTargetOrdering`):
   * with the pair guaranteed non-inverted, `responseTargetAt` IS
   * `LEAST(responseTargetAt, resolutionTargetAt)`, the value
   * `deriveSlaStatus` treats as governing.
   *
   * The breached-before-on-track split needs no separate term: a breached
   * ticket's target is in the past and an on-track one's is in the future,
   * so ordering by the target ascending already puts breached first — which
   * also means this ordering does not depend on the current time.
   */
  @ApiProperty({ required: false, enum: ["createdAt", "updatedAt", "slaUrgency"] })
  @IsOptional()
  @IsIn(["createdAt", "updatedAt", "slaUrgency"])
  sortBy?: "createdAt" | "updatedAt" | "slaUrgency";

  @ApiProperty({ required: false, enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
