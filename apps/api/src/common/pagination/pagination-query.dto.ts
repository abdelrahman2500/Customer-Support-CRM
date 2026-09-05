import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

/** Rows returned when a caller does not ask for a specific page size. */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * The ceiling on `pageSize`.
 *
 * This is what replaces the silent `take: MAX_*_ROWS` caps. The difference
 * is the whole point of Story S-8: the old caps quietly shortened the array
 * and told the caller nothing, so a branch holding 991 tickets served 500 of
 * them and looked complete. A caller who asks for more than this gets a 400
 * and knows it, and a caller who wants all 991 rows pages through them.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Story S-8a — the first pagination contract in this codebase.
 *
 * `ListTicketsQueryDto` records why there was none before it ("no
 * precedent in this codebase to extend, and inventing one is explicitly
 * out of scope for this story"). This is that precedent, so the shape is
 * deliberately minimal: offset paging over the existing filters, no
 * cursor, no sort coupling.
 *
 * Both fields are optional, and both are validated rather than clamped.
 * Silently coercing `pageSize=1000` down to 100 would repeat the original
 * sin — a response that does not match what was asked for, with nothing to
 * say so. `@Max` makes the pipe reject it instead.
 *
 * `@Type(() => Number)` is required, not decorative: query strings arrive
 * as text, and the global `ValidationPipe` runs with `transform: true`
 * (`main.ts`), so this is the hook that turns `"2"` into `2` before
 * `@IsInt` sees it. It also gives the right rejection for free —
 * `Number("abc")` is `NaN`, which `@IsInt` fails. The decorator comes from
 * `class-transformer`, already used for the same purpose in
 * `CreateBusinessHoursCalendarDto`.
 *
 * A DTO that needs both these fields and its own filters extends this
 * class; one that already extends something else composes the two with
 * `IntersectionType` (see `ListAuditLogsQueryDto`).
 */
export class PaginationQueryDto {
  @ApiProperty({
    required: false,
    type: Number,
    minimum: 1,
    default: 1,
    description: "1-based page number.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "page must be an integer" })
  @Min(1, { message: "page must be 1 or greater" })
  page?: number;

  @ApiProperty({
    required: false,
    type: Number,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    description: `Rows per page, 1-${MAX_PAGE_SIZE}.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "pageSize must be an integer" })
  @Min(1, { message: "pageSize must be 1 or greater" })
  @Max(MAX_PAGE_SIZE, { message: `pageSize must not exceed ${MAX_PAGE_SIZE}` })
  pageSize?: number;
}
