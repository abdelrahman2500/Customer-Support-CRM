/**
 * Pure, dependency-free business-hours walk-forward math for
 * `SlaTargetListener` (Story 13). No Prisma, no I/O — takes plain data
 * shapes so it can be unit-tested exhaustively without mocking anything.
 * Deliberately reads only the shape `BusinessHoursCalendarsService`
 * already persists (Story 12) — no new abstraction, no recurrence engine.
 */

const MINUTE_MS = 60_000;
const MAX_WALK_DAYS = 1000;
const WEEKDAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface BusinessHoursDayRule {
  weekday: number; // 0=Sunday..6=Saturday
  isOpen: boolean;
  startMinute: number | null;
  endMinute: number | null;
}

export interface BusinessHoursExceptionRule {
  date: Date; // a `@db.Date` value — its UTC year/month/day is the calendar date
  isClosed: boolean;
  overrideStartMinute: number | null;
  overrideEndMinute: number | null;
}

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0=Sunday..6=Saturday
  minuteOfDay: number; // 0-1439
}

interface DayWindow {
  isOpen: boolean;
  startMinute: number;
  endMinute: number;
}

/**
 * Walks forward from `startAt` accumulating only minutes that fall inside
 * an open business-hours window (weekly schedule, overridden per-date by
 * any matching exception), interpreted in `timezone`, until `durationMinutes`
 * have been counted. Returns the UTC instant reached.
 *
 * Throws if no open window is found within `MAX_WALK_DAYS` calendar days —
 * the caller (`SlaTargetListener`) catches and logs this, same as every
 * other failure mode in that listener.
 */
export function addBusinessMinutes(
  startAt: Date,
  durationMinutes: number,
  timezone: string,
  days: BusinessHoursDayRule[],
  exceptions: BusinessHoursExceptionRule[],
): Date {
  if (durationMinutes <= 0) {
    return startAt;
  }

  const daysByWeekday = new Map(days.map((day) => [day.weekday, day]));
  const exceptionsByDate = new Map(exceptions.map((exception) => [dateKey(exception.date), exception]));

  let remaining = durationMinutes;
  let cursor = getLocalParts(startAt, timezone);
  let isFirstDay = true;

  for (let iteration = 0; iteration < MAX_WALK_DAYS; iteration += 1) {
    const window = resolveDayWindow(cursor, daysByWeekday, exceptionsByDate);
    if (window.isOpen) {
      const effectiveStart = isFirstDay ? Math.max(window.startMinute, cursor.minuteOfDay) : window.startMinute;
      if (effectiveStart < window.endMinute) {
        const available = window.endMinute - effectiveStart;
        if (available >= remaining) {
          return localPartsToUtcInstant(cursor.year, cursor.month, cursor.day, effectiveStart + remaining, timezone);
        }
        remaining -= available;
      }
    }

    const { year, month, day } = nextCalendarDate(cursor.year, cursor.month, cursor.day);
    cursor = getLocalParts(localPartsToUtcInstant(year, month, day, 0, timezone), timezone);
    isFirstDay = false;
  }

  throw new Error(
    `addBusinessMinutes: no open business hours found within ${MAX_WALK_DAYS} days — check the calendar configuration`,
  );
}

function resolveDayWindow(
  cursor: LocalParts,
  daysByWeekday: Map<number, BusinessHoursDayRule>,
  exceptionsByDate: Map<string, BusinessHoursExceptionRule>,
): DayWindow {
  const exception = exceptionsByDate.get(`${cursor.year}-${pad(cursor.month)}-${pad(cursor.day)}`);
  if (exception) {
    if (exception.isClosed || exception.overrideStartMinute === null || exception.overrideEndMinute === null) {
      return { isOpen: false, startMinute: 0, endMinute: 0 };
    }
    if (exception.overrideStartMinute >= exception.overrideEndMinute) {
      // Defensive only — BusinessHoursCalendarsService's write-time
      // validation should never persist this, but never treat an invalid
      // window as open.
      return { isOpen: false, startMinute: 0, endMinute: 0 };
    }
    return { isOpen: true, startMinute: exception.overrideStartMinute, endMinute: exception.overrideEndMinute };
  }

  const rule = daysByWeekday.get(cursor.weekday);
  if (!rule || !rule.isOpen || rule.startMinute === null || rule.endMinute === null || rule.startMinute >= rule.endMinute) {
    return { isOpen: false, startMinute: 0, endMinute: 0 };
  }
  return { isOpen: true, startMinute: rule.startMinute, endMinute: rule.endMinute };
}

function nextCalendarDate(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function dateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getLocalParts(instant: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = new Map(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const weekdayShort = parts.get("weekday") ?? "";
  return {
    year: Number(parts.get("year")),
    month: Number(parts.get("month")),
    day: Number(parts.get("day")),
    weekday: WEEKDAY_SHORT_NAMES.indexOf(weekdayShort),
    minuteOfDay: Number(parts.get("hour")) * 60 + Number(parts.get("minute")),
  };
}

/**
 * Inverse of `getLocalParts`: given local wall-clock fields in `timeZone`,
 * returns the UTC instant they represent. Standard guess-and-correct
 * technique — treats the wanted fields as if they were already UTC to get
 * a first-guess instant, measures what that guess actually renders as in
 * `timeZone`, and corrects by the difference. Converges within 2 iterations
 * for every real-world zone, including across a DST transition.
 */
function localPartsToUtcInstant(year: number, month: number, day: number, minuteOfDay: number, timeZone: string): Date {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 2; i += 1) {
    const observed = getLocalParts(new Date(guess), timeZone);
    const observedMs = Date.UTC(observed.year, observed.month - 1, observed.day) + observed.minuteOfDay * MINUTE_MS;
    const wantedMs = Date.UTC(year, month - 1, day) + minuteOfDay * MINUTE_MS;
    const diff = wantedMs - observedMs;
    if (diff === 0) {
      break;
    }
    guess += diff;
  }
  return new Date(guess);
}
