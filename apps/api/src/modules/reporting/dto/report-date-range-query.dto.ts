import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, Matches } from "class-validator";

/**
 * Story 93 — shared by all five `GET /reports/*` routes.
 *
 * `@IsDateString()` alone would be too broad: confirmed against this
 * repository's own installed `class-validator@0.15.1` source, it is a bare
 * alias for `IsISO8601` (`validator.js`'s `isISO8601`, no format
 * narrowing), which accepts full datetimes with a `T`/time/timezone-offset
 * component (`2026-01-01T00:00:00.000Z`), week-dates (`2026-W01`), ordinal
 * dates (`2026-032`), and even truncated year-only/year-month forms — none
 * of which match this story's documented `YYYY-MM-DD`-only contract, and
 * `{ strict: true }` only adds calendar-validity checking, not format
 * narrowing.
 *
 * A single `@Matches` regex is the smallest repository-consistent fix —
 * mirrors `UpdateBrandingDto`'s own `primaryColor`/`secondaryColor`
 * precedent (`apps/api/src/modules/admin/dto/update-branding.dto.ts`): one
 * precise format decorator, not stacked with a broader built-in validator
 * that could re-widen what's accepted. Calendar-validity (rejecting a
 * shape-valid but non-existent date like `2026-02-30`) is checked
 * separately, at parse time, in `resolveReportDateRange` — see that file's
 * own doc comment for why `new Date(...)` alone cannot be trusted for this.
 */
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ReportDateRangeQueryDto {
  @ApiProperty({ required: false, example: "2026-01-01", description: "YYYY-MM-DD, inclusive" })
  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN, { message: "from must be in YYYY-MM-DD format" })
  from?: string;

  @ApiProperty({ required: false, example: "2026-01-31", description: "YYYY-MM-DD, inclusive" })
  @IsOptional()
  @Matches(CALENDAR_DATE_PATTERN, { message: "to must be in YYYY-MM-DD format" })
  to?: string;
}
