import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
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
 */
export class ListAuditLogsQueryDto extends ReportDateRangeQueryDto {
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
