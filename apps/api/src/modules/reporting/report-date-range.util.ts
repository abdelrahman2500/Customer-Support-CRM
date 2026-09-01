import { BadRequestException } from "@nestjs/common";

/** A Prisma-ready `createdAt` (or equivalent timestamp) filter fragment.
 * Empty (`{}`) means "no range" — every caller must only spread this into
 * a `where` clause when at least one key is present, so an all-omitted
 * range produces a `where` textually identical to the pre-Story-93 query. */
export interface DateRangeFilter {
  gte?: Date;
  lt?: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parses a `YYYY-MM-DD` string already shape-validated by
 * `ReportDateRangeQueryDto`'s `@Matches` into a real UTC-midnight `Date`,
 * rejecting a shape-valid but non-existent calendar date (e.g.
 * `2026-02-30`). `new Date("2026-02-30")` does **not** throw or return an
 * Invalid Date — it silently rolls over to March 2nd (confirmed empirically
 * against this repository's Node runtime) — which would otherwise corrupt
 * a report's date-range boundary with no error at all. The round-trip
 * check below (re-reading the parsed date's own year/month/day and
 * comparing them back to what was requested) is the same technique
 * `validator.js`'s own `isISO8601`'s internal `isValidDate` uses for its
 * `strict` mode, applied here to this story's narrower `YYYY-MM-DD`-only
 * shape.
 */
function parseCalendarDate(value: string, fieldName: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${fieldName} is not a valid calendar date`);
  }
  return date;
}

/**
 * Story 93 — shared by all five `ReportingService` methods. `from` is
 * inclusive; `to` is inclusive at the calendar-day level, implemented as an
 * exclusive next-day boundary (`lt`) — `to`'s own parsed value is that
 * day's UTC midnight, so a naive `lte` would wrongly exclude nearly the
 * entire `to` day. Both omitted → `{}`, the exact all-time, pre-Story-93
 * behavior. `from === to` is a valid one-day-wide window; `from > to`
 * throws `BadRequestException`.
 *
 * UTC-only, not branch-timezone-aware — mirrors this codebase's one other
 * date-string precedent (`CreateBusinessHoursExceptionDto`'s `date` field,
 * parsed via a plain `new Date(dto.date)` in
 * `business-hours-calendars.service.ts`, despite `Branch.timezone` existing
 * for a different purpose — business-hours minute-of-day scheduling, not
 * calendar-date boundaries). A branch far from UTC will see its "day"
 * boundary shift by its offset; this is a documented, deliberate
 * limitation, not an oversight.
 */
export function resolveReportDateRange(from?: string, to?: string): DateRangeFilter {
  const fromDate = from ? parseCalendarDate(from, "from") : undefined;
  const toDate = to ? parseCalendarDate(to, "to") : undefined;

  if (fromDate && toDate && fromDate > toDate) {
    throw new BadRequestException("from must not be after to");
  }

  return {
    ...(fromDate ? { gte: fromDate } : {}),
    ...(toDate ? { lt: new Date(toDate.getTime() + MS_PER_DAY) } : {}),
  };
}

/** `true` once `resolveReportDateRange` returned a non-empty filter —
 * every service method uses this to decide whether to spread `createdAt`
 * into its `where` at all, so an all-omitted range's query is textually
 * identical to the pre-Story-93 one. */
export function hasDateRange(range: DateRangeFilter): boolean {
  return Boolean(range.gte || range.lt);
}
