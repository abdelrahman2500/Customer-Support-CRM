import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";
import { ReportDateRangeQueryDto } from "../../reporting/dto/report-date-range-query.dto";

/**
 * Story 104 — `action`/`entityType` are exact-match equality filters, not
 * `contains`: every existing value is a fixed, code-defined string
 * (`"auth.login"`, `"role.updated"`, `"ticket"`, ...), never free text a
 * caller might partially remember, unlike `Customer.displayName`/
 * `KnowledgeBaseArticle.title` (Stories 101/102's own `contains` filters).
 *
 * `from`/`to` are inherited as-is from `ReportDateRangeQueryDto` — the
 * exact same `YYYY-MM-DD` shape/validation/semantics every `GET
 * /reports/*` route already uses, reused verbatim rather than
 * reimplementing calendar-date parsing a second time.
 *
 * Story S-8a — `page`/`pageSize` join the existing filters. This DTO
 * already extended `ReportDateRangeQueryDto`, and TypeScript has no
 * multiple inheritance, so the two bases are composed with
 * `IntersectionType` — `@nestjs/swagger`'s own tool for exactly this,
 * which copies both classes' validation and Swagger metadata onto the
 * result. The alternative, re-declaring `from`/`to` here, would duplicate
 * `ReportDateRangeQueryDto`'s `@Matches` pattern and the long comment
 * explaining why it is a regex rather than `@IsDateString`. Putting
 * pagination on `ReportDateRangeQueryDto` instead was rejected for the
 * opposite reason: every `GET /reports/*` route shares that class and
 * would then silently accept `page`/`pageSize` it does not implement.
 */
export class ListAuditLogsQueryDto extends IntersectionType(
  ReportDateRangeQueryDto,
  PaginationQueryDto,
) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  actorId?: string;
}
