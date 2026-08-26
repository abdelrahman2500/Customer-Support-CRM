# Story 13 — SLA Business-Hours-Aware Target Computation

## Prerequisites

- `sla-policy-foundation` Stories 10–12 completed (see [10-story-sla-policy-foundation.md](./10-story-sla-policy-foundation.md), [11-story-sla-target-computation.md](./11-story-sla-target-computation.md), [12-story-sla-business-hours-calendar-foundation.md](./12-story-sla-business-hours-calendar-foundation.md), implemented and committed as `b0bc708`/`572cae5`/`8bc9cfe`): the real `SlaPolicy`, `SlaTicketTarget`, `SlaTargetListener`, and `BusinessHoursCalendar`/`BusinessHoursDay`/`BusinessHoursException` this story consumes.
- `Branch.timezone` (`project-foundation` Story 02) — the IANA timezone basis this story interprets calendar minute-of-day values against.
- This is the story the "Next-Story Recon Report" produced after Story 12 identified as the only remaining SLA & Automation item with its prerequisite already met in the live repository (`BusinessHoursCalendar` had no consumer). The intake this plan was generated from explicitly settles: continue `sla-policy-foundation` as Story 13; do not redesign the calendar CRUD model from Story 12; the `ticket.created`-only trigger and the immutable-target-once-written rule from Story 11 are unchanged.

---

## Story Goal

Make `SlaTargetListener` consume the branch's `BusinessHoursCalendar` (Story 12) when it exists, computing `responseTargetAt`/`resolutionTargetAt` by walking forward from `ticket.createdAt` through the branch's actual open business-hours windows (in `Branch.timezone`), skipping closed weekdays and closed exceptions, and using an exception's overridden window in place of the normal weekly schedule where one exists. **When no `BusinessHoursCalendar` exists for the branch, the listener falls back to exactly Story 11's plain wall-clock arithmetic** — this is not a stylistic choice, it is required by evidence: no seed data creates a calendar (Story 12's "Seed changes only if genuinely required" — none were made), so every existing `SlaTargetListener`/`SlaPolicy` unit and e2e test creates tickets against a branch with no calendar and must keep passing unchanged.

**Not in scope:** anything under `apps/api/src/modules/tickets/**`; `ticket.updated`/`ticket.recategorized`; recomputing an already-persisted `SlaTicketTarget`; any change to the `BusinessHoursCalendar` CRUD surface, its schema, or its minute-range semantics; `sla-timers`/BullMQ/`sla.at_risk`/`sla.breached`/escalation/`AutomationRule`/Notifications; the policy-resolution rule from Story 11 (most-specific-wins, earliest-`createdAt` tie-break stays exactly as implemented).

---

## Context — Read These Files First

1. `apps/api/src/modules/sla-policies/sla-target.listener.ts` (116 lines, read in full) — the exact method this story modifies: `onTicketCreated` (lines 36-90) currently computes `responseTargetAt`/`resolutionTargetAt` via `new Date(ticket.createdAt.getTime() + bestPolicy.responseTargetMinutes * MINUTE_MS)` (lines 79-84). `selectMostSpecificPolicy` (lines 100-114) and the policy-candidate query (lines 53-68) are **unchanged by this story** — do not touch the resolution rule.
2. `apps/api/src/modules/sla-policies/sla-target.listener.spec.ts` (192 lines, read in full) — the hand-built-`PrismaService`-mock pattern this story's new test cases extend. In particular, the existing test "creates a target computed from the ticket's createdAt plus the matched policy's minute counts" (lines 105-119) and "prefers the more specific of two matching candidates" (lines 121-146) **must keep passing unmodified** — they exercise the no-calendar fallback path this story must preserve exactly.
3. `apps/api/prisma/schema.prisma` — `BusinessHoursCalendar` (lines 378-389), `BusinessHoursDay` (lines 402-414, `weekday Int` 0=Sunday..6=Saturday per its own doc comment, `isOpen`, nullable `startMinute`/`endMinute` 0-1439), `BusinessHoursException` (lines 429-441, `date @db.Date`, `isClosed`, nullable `overrideStartMinute`/`overrideEndMinute`), `Branch.timezone` (line 41) and `Branch.businessHoursCalendar` (line 47, nullable — confirms a branch may have none).
4. `apps/api/src/modules/sla-policies/business-hours-calendars.service.ts` (345 lines, read in full) — confirms the exact write-time invariants this story's read-side calculator may rely on without re-validating: `validateDayEntries` (lines 232-267) guarantees any *persisted* calendar has exactly 7 `BusinessHoursDay` rows, one per weekday 0-6, each internally consistent (`isOpen` true ⇒ both minutes set and `startMinute < endMinute`; `isOpen` false ⇒ both null); `validateExceptionFields` (lines 269-294) guarantees the same consistency for `BusinessHoursException` rows.
5. `apps/api/prisma/seed.ts` — `DEFAULT_BRANCH_TIMEZONE = "UTC"` (line 46), used by the one seeded branch (line 76). Confirms the seeded/e2e-tested branch's timezone is `"UTC"` — relevant for designing deterministic e2e fixtures (Task 4 below) without any real non-UTC offset to account for in test data, even though the calculator itself must still be correct for arbitrary IANA zones.
6. `apps/api/test/sla-targets.e2e-spec.ts` (201 lines, read in full) — the "computes a target when a matching, active policy exists" test (lines 122-131) asserts `resolutionTargetAt - responseTargetAt === (240 - 30) * 60_000` exactly. **This assertion is no longer safe once this story ships** — see Task 3 below for why and what replaces it.
7. `apps/api/test/business-hours-calendars.e2e-spec.ts` (read in full) — its own `beforeAll` creates (or, on a rerun, resets via `PATCH`) a real `BusinessHoursCalendar` for the **same single seeded branch** every `SlaPolicy`/`Ticket` e2e test in the suite runs against (Mon–Fri 09:00–17:00 UTC minute-of-day 540–1020, Sat/Sun closed). Under `apps/api/package.json`'s `test:e2e`/`test:all` scripts' `--no-file-parallelism` flag (added in Story 11), Vitest runs e2e spec files sequentially in filename order, and `business-hours-calendars.e2e-spec.ts` sorts alphabetically before `sla-targets.e2e-spec.ts` — meaning by the time this story's own behavior runs against the shared database, a real, non-continuous calendar reliably already exists for the seeded branch. This is the direct evidence behind Task 3's assertion fix and Task 5's e2e design.
8. `apps/api/package.json` — `test:e2e`/`test:all` scripts (`vitest run e2e-spec --no-file-parallelism` / `vitest run --no-file-parallelism`), confirming e2e files run sequentially, not concurrently, in this repo (Story 11's fix). No change needed here.
9. `apps/api/package.json`'s `dependencies` block — confirms **no date/timezone library** (`date-fns`, `luxon`, `dayjs`, `moment`, or similar) exists anywhere in `apps/api`. Confirmed via a repo-wide grep for `Intl.DateTimeFormat` too: no existing backend usage precedent exists yet. This story is the first to add real timezone-conversion logic to the backend and does so with the native `Intl.DateTimeFormat`, matching `docs/architecture/10-i18n-and-rtl.md`'s own mandate ("Dates... use locale-driven `Intl.DateTimeFormat`... never manual strings") rather than adding a new dependency — see Task 1.
10. `apps/api/src/modules/sla-policies/sla-policies.module.ts` — confirms the existing provider list; **no change needed** (the new calculator is a plain exported-function module, not an injectable service, so nothing new needs registering).

---

## Design (resolved during this planning pass, per the intake's explicit delegation)

1. **No calendar for the branch → exact Story 11 wall-clock fallback.** Forced by evidence (Context item 2/6): every existing test creates tickets against a calendar-less branch and must keep passing byte-for-byte.
2. **Where the algorithm lives:** a new, dependency-free pure-function module (`business-hours-calculator.ts`), not a service — the walk-forward has no I/O and is far easier to unit-test exhaustively as plain functions than as a Prisma-mocked class method. `SlaTargetListener` becomes the only caller.
3. **One open interval per weekday, no recurrence engine:** unchanged from Story 12 — the calculator reads exactly the shape Story 12 already persists (a single `startMinute`/`endMinute` pair per day/exception). No new abstraction is introduced.
4. **Walk-forward algorithm:** starting from `ticket.createdAt`, convert to local calendar date + minute-of-day in `Branch.timezone` via `Intl.DateTimeFormat`. For each local calendar date in turn: resolve its effective window (an exception for that date wins over the weekday's `BusinessHoursDay` row; `isClosed` or `isOpen:false` contributes zero minutes); on the **first** day only, the available window starts at `max(windowStart, creationMinuteOfDay)` (a day already in progress when the ticket is created only contributes its remaining minutes); on every later day the full window counts. Accumulate until the remaining duration is covered by the current day's available window, then convert the exact local instant reached back to a UTC `Date`. A day contributing zero minutes (closed, or already past its window on day one) simply advances to the next calendar date.
5. **Local-time round trip without a new dependency:** `Intl.DateTimeFormat(..., { timeZone, hourCycle: "h23", weekday: "short" })` (explicit `hourCycle: "h23"` avoids a known ICU quirk where midnight can render as hour `24` instead of `00`; explicit `"en-US"` locale keeps the `weekday` short-name output ("Sun".."Sat") stable regardless of server locale) extracts local year/month/day/weekday/minute-of-day from a UTC instant. Converting local wall-clock values back to a UTC instant uses the standard guess-and-correct technique: treat the wanted local fields as if they were UTC to get a first-guess instant, re-derive what that guess actually renders as in the target zone, and correct by the difference — this converges in at most two iterations for every real-world zone (handles a DST transition without special-casing it).
6. **Weekday numbering:** 0=Sunday..6=Saturday, matching `BusinessHoursDay.weekday`'s own documented convention (schema.prisma line 391) and JS `Date#getUTCDay()`.
7. **Exception matching:** `BusinessHoursException.date` is a `@db.Date` value with no time component: Prisma returns it as a UTC-midnight `Date` whose UTC year/month/day *is* the intended calendar date (Story 12's own design). Matching an exception to a walked-forward local calendar date is therefore a plain `"YYYY-MM-DD"` string comparison of `date.getUTCFullYear()/getUTCMonth()+1/getUTCDate()` against the walk's local year/month/day — no further timezone conversion needed for the exception side.
8. **Safety cap:** the walk-forward loop is bounded (1000 calendar days). A calendar with every weekday closed and no open exception in that window throws a descriptive `Error`, caught by `SlaTargetListener`'s existing try/catch (logged, no target persisted) — the same "never break the request" guarantee every other failure mode in this listener already has. This is a defensive backstop, not a business rule.
9. **A genuine, accepted limitation this story does not "fix":** `BusinessHoursDay`/`BusinessHoursException` minute values are constrained to 0-1439 (Story 12's own range — not reopened here), so a day can represent at most 1439 open minutes, one short of a full 1440-minute day. A calendar configured "open every day, 00:00 to 23:59" is therefore *almost*, but not bit-for-bit, equivalent to unrestricted wall-clock time for a target spanning more than one calendar day — it accumulates roughly one minute of extra drift per day boundary crossed. The **exact** wall-clock-equivalence guarantee this story provides is for the **no-calendar-at-all** case only (Design decision 1); a calendar that merely happens to look continuous is out of scope for exact parity, and this is not a defect to fix by reopening Story 12's minute-range semantics.

---

## Implementation Tasks

### 1 — `BusinessHoursCalculator`

Create file: `apps/api/src/modules/sla-policies/business-hours-calculator.ts`

```typescript
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
```

### 2 — `SlaTargetListener`

File: `apps/api/src/modules/sla-policies/sla-target.listener.ts`

Add an import and replace the target-computation block. The ticket re-fetch (lines 39-51), the policy-candidate query (lines 53-68), and `selectMostSpecificPolicy` (lines 100-114) are **unchanged**.

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_CREATED_EVENT } from "../tickets/tickets.events";
import type { TicketCreatedEvent } from "../tickets/tickets.events";
import { addBusinessMinutes } from "./business-hours-calculator";

const MINUTE_MS = 60_000;
```

(`addBusinessMinutes` import added; `MINUTE_MS` stays — still used by the no-calendar fallback path.)

Replace the body from the `slaPolicy.findMany` result onward (the current lines 70-86) with:

```typescript
      const bestPolicy = this.selectMostSpecificPolicy(candidates);
      if (!bestPolicy) {
        return;
      }

      const calendar = await this.prisma.businessHoursCalendar.findFirst({
        where: { branchId: ticket.branchId },
        include: { branch: { select: { timezone: true } }, days: true, exceptions: true },
      });

      const [responseTargetAt, resolutionTargetAt] = calendar
        ? [
            addBusinessMinutes(
              ticket.createdAt,
              bestPolicy.responseTargetMinutes,
              calendar.branch.timezone,
              calendar.days,
              calendar.exceptions,
            ),
            addBusinessMinutes(
              ticket.createdAt,
              bestPolicy.resolutionTargetMinutes,
              calendar.branch.timezone,
              calendar.days,
              calendar.exceptions,
            ),
          ]
        : [
            new Date(ticket.createdAt.getTime() + bestPolicy.responseTargetMinutes * MINUTE_MS),
            new Date(ticket.createdAt.getTime() + bestPolicy.resolutionTargetMinutes * MINUTE_MS),
          ];

      await this.prisma.slaTicketTarget.create({
        data: {
          ticketId: event.ticket.id,
          slaPolicyId: bestPolicy.id,
          responseTargetAt,
          resolutionTargetAt,
        },
      });
```

**No change** to the surrounding `try`/`catch`, the department/category/priority filter construction, or `selectMostSpecificPolicy`. `addBusinessMinutes` throwing (Design decision 8) is caught by this same existing `catch (error)` block, logged via the existing `this.logger.error(...)` call, exactly like a Prisma failure would be.

### 3 — Fix the now-order-dependent assertion in `sla-targets.e2e-spec.ts`

File: `apps/api/test/sla-targets.e2e-spec.ts`, the "computes a target when a matching, active policy exists" test (lines 122-131).

Per Context item 6/7: once this story ships, a real (non-continuous) `BusinessHoursCalendar` reliably already exists for the seeded branch by the time this test runs, so the exact `(240 - 30) * 60_000` millisecond-delta assertion is no longer guaranteed. Replace it with an invariant that holds **regardless** of whether business-hours math applies: `resolutionTargetAt` is always at or after `responseTargetAt`, because both are computed by the same monotonic walk-forward from the same start instant and `resolutionTargetMinutes` (240) is strictly greater than `responseTargetMinutes` (30) — so the resolution walk can never finish before the response walk, whether wall-clock or business-hours-aware.

```typescript
  it("computes a target when a matching, active policy exists", async () => {
    const response = await waitForSlaTarget(app.getHttpServer(), adminAccessToken, matchingTicketId);
    expect(response.status).toBe(200);

    expect(response.body.ticketId).toBe(matchingTicketId);
    const responseTargetAt = new Date(response.body.responseTargetAt).getTime();
    const resolutionTargetAt = new Date(response.body.resolutionTargetAt).getTime();
    // resolutionTargetMinutes (240) > responseTargetMinutes (30), and both
    // are walked forward from the same instant — resolution can never land
    // before response, whether or not business-hours math applies (Story 13).
    expect(resolutionTargetAt).toBeGreaterThanOrEqual(responseTargetAt);
  });
```

No other change to this file.

### 4 — Unit tests: `BusinessHoursCalculator`

Create file: `apps/api/src/modules/sla-policies/business-hours-calculator.spec.ts`

Pure-function tests — no Prisma mocking. Build small `BusinessHoursDayRule[]`/`BusinessHoursExceptionRule[]` fixtures directly. Cover at minimum:

- A single-day, single-window case: creation mid-window, duration well within the remaining window → result equals `startAt + duration` exactly (no boundary crossed).
- Creation **before** the day's window opens → the response window starts at the window's own start, not at creation time.
- Creation **after** the day's window has already closed → that day contributes zero; the result lands in the next open day.
- A closed weekday (`isOpen: false`) is skipped entirely even with ample remaining duration.
- Duration exactly exhausts a day's remaining window (`available === remaining`) → result equals that window's end instant exactly.
- Duration spans multiple business days, crossing a closed weekend (`isOpen:false` for weekday 0 and 6) → correctly walks past both closed days.
- A closed `BusinessHoursException` on an otherwise-open weekday → that date contributes zero.
- An override `BusinessHoursException` with a **narrower** window than the normal weekday → the override window is used, not the day's normal one.
- An override `BusinessHoursException` on an otherwise-**closed** weekday → that specific date opens per the override.
- A non-UTC fixed-offset timezone (e.g. `"Etc/GMT-4"`) — confirms the local-time conversion is timezone-aware, not implicitly UTC.
- A real DST-observing IANA zone (e.g. `"America/New_York"`) with `startAt`/expected-result dates chosen to straddle a known spring-forward or fall-back transition for that zone — confirms `localPartsToUtcInstant`'s correction loop produces the correct instant across the transition. Verify the exact transition date for the chosen year against a reliable source before hardcoding it (do not guess).
- `durationMinutes <= 0` → returns `startAt` unchanged.
- A weekday missing from the `days` array (fewer than 7 provided) → treated as closed for that weekday (defensive).
- An all-closed calendar with no open exception → throws (assert `.toThrow()`, no need to assert the exact message).

### 5 — Unit tests: `SlaTargetListener` (extend `sla-target.listener.spec.ts`)

Add to the existing hand-built `buildPrismaMock()` (lines 7-19): a `businessHoursCalendar: { findFirst: vi.fn() }` entry.

Add cases:

- When `prisma.businessHoursCalendar.findFirst` resolves a calendar (with `branch.timezone`, `days`, `exceptions`), the listener calls `addBusinessMinutes` (import and spy, or assert via a calendar fixture simple enough to hand-compute the expected result) for **both** response and resolution, and persists those results — not the plain wall-clock values.
- When `prisma.businessHoursCalendar.findFirst` resolves `null`, the listener falls back to plain wall-clock arithmetic — **re-run the existing "creates a target computed from the ticket's createdAt plus the matched policy's minute counts" and "prefers the more specific of two matching candidates" cases unmodified** to prove this fallback path is byte-for-byte the same as before this story.
- `addBusinessMinutes` throwing (e.g. an all-closed calendar) is caught and logged, `onTicketCreated` still resolves without throwing — mirrors the existing "does not throw when persistence fails" case.

### 6 — E2E: business-hours-aware computation

Create file: `apps/api/test/sla-business-hours-target-computation.e2e-spec.ts`

Bootstraps the real `AppModule` exactly like `sla-targets.e2e-spec.ts`. Because `BusinessHoursCalendar` is a singleton per branch (Story 12) and the same seeded branch is shared across the whole e2e run, this suite's `beforeAll` **resets the calendar to a schedule it fully controls** via `PATCH /api/v1/business-hours-calendars` (the existing Story 12 endpoint — not a new one), computed **relative to the actual current UTC date** (the seeded branch's `timezone` is `"UTC"` — Context item 5) so the suite is deterministic regardless of which real calendar day it happens to run on:

1. Compute `today = new Date().getUTCDay()` and set that weekday's `BusinessHoursDay` to `isOpen: true, startMinute: 0, endMinute: 1439` (open essentially all day); set the next weekday (`(today + 1) % 7`) to `isOpen: false`; leave the remaining 5 weekdays open 09:00–17:00 (matching `business-hours-calendars.e2e-spec.ts`'s own fixture shape, for consistency).
2. **Skip-over-a-closed-day case:** create a fresh `SlaPolicy` (unique `category`, per the existing `sla-targets.e2e-spec.ts` collision-avoidance convention) with `responseTargetMinutes` larger than today's remaining open minutes from "now" but small enough to land within the following open day (skipping the deliberately-closed day set up in step 1). Create a ticket with that category "now", poll `GET /tickets/:id/sla-target` (reusing the polling helper pattern from `sla-targets.e2e-spec.ts`), and assert the resulting `responseTargetAt` falls on a date **after** the deliberately-closed day, not on it.
3. **Closed-exception case:** `POST /business-hours-calendars/exceptions` with `date` = the deliberately-closed weekday's next occurrence, `isClosed: true` (or reuse an existing closed day directly, whichever is simpler to compute deterministically) and confirm a policy/ticket combination that would otherwise land there skips it too.
4. **Override-exception case:** `POST /business-hours-calendars/exceptions` with `date` = today, `isClosed: false`, `overrideStartMinute`/`overrideEndMinute` narrower than today's step-1 schedule; create a ticket and a policy whose response target would fall inside the normal (wider) window but outside the override window, and assert the computed target respects the **override**, not the normal day's window.
5. **Regression sanity:** the existing "no calendar" behavior is not retested here (it lives in `sla-target.listener.spec.ts`/the unmodified parts of `sla-targets.e2e-spec.ts`) — this suite only exercises the calendar-present path.

Restore the calendar to `business-hours-calendars.e2e-spec.ts`'s own baseline schedule (Mon–Fri 09:00–17:00, weekends closed) at the end of `afterAll`, via the same `PATCH` endpoint, so this suite doesn't leave the shared branch's calendar in a state that could confuse a later run of other suites.

### 7 — Full regression

No other file changes. Re-run unmodified: `sla-policies.e2e-spec.ts`, `business-hours-calendars.e2e-spec.ts`, `tickets.e2e-spec.ts`, `customers.e2e-spec.ts`, `identity.e2e-spec.ts`, and every existing unit spec.

---

## Edge Cases & Failure Modes

- **No `BusinessHoursCalendar` for the branch:** falls back to exact Story 11 wall-clock arithmetic — not an error, the expected/common case today (no seed data creates a calendar).
- **A `BusinessHoursDay` row missing for some weekday** (should not happen — Story 12's `validateDayEntries` guarantees exactly 7 on write): treated as closed for that weekday, defensively.
- **An exception row with an invalid override window** (should not happen — Story 12's `validateExceptionFields` guarantees `overrideStartMinute < overrideEndMinute` on write): treated as closed, defensively, never as open.
- **Every weekday closed and no open exception within 1000 days:** `addBusinessMinutes` throws; caught and logged by `SlaTargetListener`'s existing `catch` — no target is persisted, exactly like today's "no matching policy" outcome is a valid non-error, non-crashing result.
- **Ticket created exactly at a window's start:** included (the boundary is `effectiveStart < endMinute`, inclusive at the start).
- **Ticket created exactly at a window's end:** excluded from that day (available minutes = 0 at that exact instant), rolls to the next open day.
- **DST transition during a multi-day walk:** handled by re-deriving local parts fresh, from `Intl`, on every iteration — no fixed "24-hour day" assumption is made anywhere in the walk.
- **A calendar that looks "continuous" (open every day 00:00–23:59) is not bit-for-bit identical to the no-calendar wall-clock path for a target spanning more than one day** — an accepted, documented consequence of Story 12's 0-1439 minute range (Design decision 9), not a defect.
- **`durationMinutes <= 0`** (should not happen — `SlaPolicy`'s DTOs enforce `@Min(1)`): returns `startAt` unchanged, defensively.
- **The order e2e spec files run in matters to `sla-targets.e2e-spec.ts`'s own assertions** (Context item 7) — fixed by Task 3; no other existing suite's assertions depend on the branch's calendar state, since `tickets.e2e-spec.ts`/`customers.e2e-spec.ts`/`identity.e2e-spec.ts` never assert anything about `SlaTicketTarget`.

---

## Test Plan

1. **Unit — `apps/api/src/modules/sla-policies/business-hours-calculator.spec.ts` (new):** all cases in Task 4. No database dependency.
2. **Unit — `apps/api/src/modules/sla-policies/sla-target.listener.spec.ts` (extended):** all cases in Task 5, including re-running the pre-existing no-calendar cases unmodified as an explicit regression guard.
3. **Integration — `apps/api/test/sla-business-hours-target-computation.e2e-spec.ts` (new):** the scenarios in Task 6, against real Postgres/Redis.
4. **Integration — `apps/api/test/sla-targets.e2e-spec.ts` (one assertion updated, Task 3):** re-run to confirm the updated assertion still passes.
5. **Regression — no changes, re-run only:** `sla-policies.e2e-spec.ts`, `business-hours-calendars.e2e-spec.ts`, `tickets.e2e-spec.ts`, `customers.e2e-spec.ts`, `identity.e2e-spec.ts`, and every existing unit spec (`identity.service.spec.ts`, `permissions.guard.spec.ts`, `customers.service.spec.ts`, `tickets.service.spec.ts`, `ticket-history.listener.spec.ts`, `sla-policies.service.spec.ts`, `business-hours-calendars.service.spec.ts`) must all still pass.

---

## Migration / Rollback

None required. This story adds no new Prisma model or field and modifies no existing one — it only reads `BusinessHoursCalendar`/`BusinessHoursDay`/`BusinessHoursException` (Story 12) and changes application logic inside `SlaTargetListener`.

---

## Verification Steps

1. **Backend builds:** `pnpm --filter @crm/api typecheck`, `pnpm --filter @crm/api lint`, `pnpm --filter @crm/api build`.
2. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` in the repository root — confirm zero regressions in `apps/web`/`apps/portal`/`apps/worker`/`packages/*`.
3. **Unit tests:** `pnpm --filter @crm/api test` — must pass, including the new `business-hours-calculator.spec.ts` and the extended `sla-target.listener.spec.ts`.
4. **Live database:** `docker compose up -d postgres redis` (use the documented temporary `5433:5432` fallback if the native PostgreSQL service is again occupying `5432` — revert both `docker-compose.yml` and `apps/api/.env` immediately after, exactly as Stories 06–12 did), `pnpm --filter @crm/api exec prisma migrate deploy`, `pnpm --filter @crm/api prisma:seed` (idempotency check — no schema change, so this should be a no-op verification only).
5. **Integration tests:** `pnpm --filter @crm/api test:e2e` — must pass, including the new e2e suite and the updated `sla-targets.e2e-spec.ts` assertion; run at least twice to confirm no flakiness from the real-current-date-relative fixture design in Task 6.
6. **Regression:** confirm the full existing unit + e2e suite is otherwise unaffected.
7. **Hygiene:** `git status`; `git diff --stat -- .squad/config.yaml` (must be empty); confirm `apps/api/src/modules/tickets/**` has an empty diff.
8. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] `SlaTargetListener` uses `BusinessHoursCalendar`/`BusinessHoursDay`/`BusinessHoursException` (via `Branch.timezone`) to compute `responseTargetAt`/`resolutionTargetAt` when a calendar exists for the ticket's branch.
- [ ] When no calendar exists, the listener's output is unchanged from Story 11 (plain wall-clock arithmetic) — proven by re-running the pre-existing unit tests unmodified.
- [ ] Closed weekdays and closed exceptions contribute zero business minutes; override exceptions replace the normal weekday window for that date only.
- [ ] Targets spanning multiple business windows/days are computed correctly, including across a closed weekend and a DST transition (unit-tested).
- [ ] The Story 11 policy-resolution rule (most-specific-wins, earliest-`createdAt` tie-break) is untouched.
- [ ] No change under `apps/api/src/modules/tickets/**`.
- [ ] No change to the `BusinessHoursCalendar` CRUD surface, schema, or minute-range semantics from Story 12.
- [ ] No new Prisma migration.
- [ ] `sla-targets.e2e-spec.ts`'s previously-order-dependent assertion is replaced with a calendar-agnostic invariant; the rest of that file is unchanged.
- [ ] New unit coverage (`business-hours-calculator.spec.ts`) and extended `sla-target.listener.spec.ts` coverage exist; new e2e coverage (`sla-business-hours-target-computation.e2e-spec.ts`) exercises the calendar-present path end-to-end.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access, Customer Management, Ticketing, SLA Policy Foundation) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
