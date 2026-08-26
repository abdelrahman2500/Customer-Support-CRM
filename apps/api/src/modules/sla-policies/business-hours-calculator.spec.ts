import { describe, expect, it } from "vitest";
import { addBusinessMinutes } from "./business-hours-calculator";
import type { BusinessHoursDayRule, BusinessHoursExceptionRule } from "./business-hours-calculator";

// Mon(1)-Fri(5) open 09:00-17:00 (540-1020 minutes since midnight), Sat(6)/Sun(0)
// closed — mirrors business-hours-calendars.e2e-spec.ts's own fixture shape.
const FULL_WEEK: BusinessHoursDayRule[] = [
  { weekday: 0, isOpen: false, startMinute: null, endMinute: null },
  { weekday: 1, isOpen: true, startMinute: 540, endMinute: 1020 },
  { weekday: 2, isOpen: true, startMinute: 540, endMinute: 1020 },
  { weekday: 3, isOpen: true, startMinute: 540, endMinute: 1020 },
  { weekday: 4, isOpen: true, startMinute: 540, endMinute: 1020 },
  { weekday: 5, isOpen: true, startMinute: 540, endMinute: 1020 },
  { weekday: 6, isOpen: false, startMinute: null, endMinute: null },
];

function exception(
  overrides: Partial<Omit<BusinessHoursExceptionRule, "date">> & { date: string },
): BusinessHoursExceptionRule {
  return {
    isClosed: true,
    overrideStartMinute: null,
    overrideEndMinute: null,
    ...overrides,
    date: new Date(overrides.date),
  };
}

describe("addBusinessMinutes", () => {
  // 2026-01-07 is a Wednesday (weekday 3); 2026-01-01 is a Thursday.
  it("computes the target within a single day when it fits in the remaining window", () => {
    const result = addBusinessMinutes(
      new Date("2026-01-07T10:00:00.000Z"), // 10:00 UTC, mid-window
      60,
      "UTC",
      FULL_WEEK,
      [],
    );
    expect(result).toEqual(new Date("2026-01-07T11:00:00.000Z"));
  });

  it("starts the window at the window's own start when creation is before it opens", () => {
    const result = addBusinessMinutes(
      new Date("2026-01-07T06:00:00.000Z"), // 06:00 UTC, before the 09:00 open
      30,
      "UTC",
      FULL_WEEK,
      [],
    );
    expect(result).toEqual(new Date("2026-01-07T09:30:00.000Z"));
  });

  it("contributes zero for the remainder of a day whose window has already closed", () => {
    // 2026-01-14 is the next Wednesday after 2026-01-07.
    const result = addBusinessMinutes(
      new Date("2026-01-07T20:00:00.000Z"), // 20:00 UTC, well after the 17:00 close
      30,
      "UTC",
      [{ weekday: 3, isOpen: true, startMinute: 540, endMinute: 1020 }], // only Wednesday is represented — every other weekday is "missing"
      [],
    );
    expect(result).toEqual(new Date("2026-01-14T09:30:00.000Z"));
  });

  it("skips a closed weekday entirely even with ample remaining duration", () => {
    const onlyMonday: BusinessHoursDayRule[] = [{ weekday: 1, isOpen: true, startMinute: 540, endMinute: 1020 }];
    // 2026-01-05 is a Monday; the next Monday is 2026-01-12.
    const result = addBusinessMinutes(new Date("2026-01-05T16:30:00.000Z"), 90, "UTC", onlyMonday, []);
    expect(result).toEqual(new Date("2026-01-12T10:00:00.000Z"));
  });

  it("returns the window's end exactly when the remaining duration exactly exhausts it", () => {
    // 2026-01-09 is a Friday; 16:30 UTC leaves exactly 30 minutes until 17:00.
    const result = addBusinessMinutes(new Date("2026-01-09T16:30:00.000Z"), 30, "UTC", FULL_WEEK, []);
    expect(result).toEqual(new Date("2026-01-09T17:00:00.000Z"));
  });

  it("spans multiple business days, skipping a closed weekend", () => {
    // Friday 2026-01-09 16:30 UTC: 30 min remain in the window (0 wasted),
    // 60 more minutes carry over Sat 2026-01-10 and Sun 2026-01-11 (both
    // closed) to Monday 2026-01-12, landing at 10:00.
    const result = addBusinessMinutes(new Date("2026-01-09T16:30:00.000Z"), 90, "UTC", FULL_WEEK, []);
    expect(result).toEqual(new Date("2026-01-12T10:00:00.000Z"));
  });

  it("treats a closed exception on an otherwise-open weekday as contributing zero", () => {
    // 2026-01-14 is a Wednesday (normally open); 2026-01-15 is the following Thursday.
    const result = addBusinessMinutes(
      new Date("2026-01-14T06:00:00.000Z"),
      30,
      "UTC",
      FULL_WEEK,
      [exception({ date: "2026-01-14", isClosed: true })],
    );
    expect(result).toEqual(new Date("2026-01-15T09:30:00.000Z"));
  });

  it("uses a narrower override exception window instead of the normal weekday window", () => {
    // 2026-01-14 (Wednesday) normally opens 09:00-17:00; the override narrows
    // it to 10:00-11:00. Creation at 09:00 is before the override's own
    // start, so the effective start is the override's start (10:00), not
    // the normal window's (also 09:00, but that would give a different,
    // wrong result if the override weren't applied).
    const result = addBusinessMinutes(
      new Date("2026-01-14T09:00:00.000Z"),
      30,
      "UTC",
      FULL_WEEK,
      [exception({ date: "2026-01-14", isClosed: false, overrideStartMinute: 600, overrideEndMinute: 660 })],
    );
    expect(result).toEqual(new Date("2026-01-14T10:30:00.000Z"));
  });

  it("opens an otherwise-closed weekday via an override exception", () => {
    // 2026-01-10 is a Saturday (normally closed); the override opens it 10:00-15:00.
    const result = addBusinessMinutes(
      new Date("2026-01-10T08:00:00.000Z"),
      30,
      "UTC",
      FULL_WEEK,
      [exception({ date: "2026-01-10", isClosed: false, overrideStartMinute: 600, overrideEndMinute: 900 })],
    );
    expect(result).toEqual(new Date("2026-01-10T10:30:00.000Z"));
  });

  it("is timezone-aware for a fixed, non-UTC offset with no DST", () => {
    // Asia/Dubai is a fixed UTC+4 zone, year-round. 2026-01-05 is a Monday.
    // 10:00 UTC = 14:00 local; the 09:00-17:00 local window still has 180
    // local minutes remaining, comfortably covering the 60-minute duration.
    const result = addBusinessMinutes(
      new Date("2026-01-05T10:00:00.000Z"),
      60,
      "Asia/Dubai",
      [{ weekday: 1, isOpen: true, startMinute: 480, endMinute: 1020 }],
      [],
    );
    expect(result).toEqual(new Date("2026-01-05T11:00:00.000Z"));
  });

  it("resolves correctly across a real DST spring-forward transition", () => {
    // America/New_York springs forward on 2026-03-08 (the second Sunday in
    // March), at 02:00 EST -> 03:00 EDT — local 02:00-02:59 does not exist
    // that day. Starting at local 01:00 (still EST, 06:00 UTC) with a
    // 180-(local-)minute business window open all day: the wall-clock label
    // "01:00 + 180 minutes" is "04:00", which — because the 02:00-02:59
    // label range is skipped that day — corresponds to only 120 REAL
    // elapsed minutes (06:00 UTC EST -> 08:00 UTC EDT). This mirrors how a
    // real office's posted hours behave on the clocks-forward day.
    const sundayOpenAllDay: BusinessHoursDayRule[] = [
      { weekday: 0, isOpen: true, startMinute: 0, endMinute: 1439 },
    ];
    const result = addBusinessMinutes(
      new Date("2026-03-08T06:00:00.000Z"),
      180,
      "America/New_York",
      sundayOpenAllDay,
      [],
    );
    expect(result).toEqual(new Date("2026-03-08T08:00:00.000Z"));
  });

  it("returns startAt unchanged when durationMinutes is zero or negative", () => {
    const startAt = new Date("2026-01-07T10:00:00.000Z");
    expect(addBusinessMinutes(startAt, 0, "UTC", FULL_WEEK, [])).toEqual(startAt);
    expect(addBusinessMinutes(startAt, -5, "UTC", FULL_WEEK, [])).toEqual(startAt);
  });

  it("throws when no open business hours exist within the safety cap", () => {
    const allClosed: BusinessHoursDayRule[] = FULL_WEEK.map((day) => ({
      ...day,
      isOpen: false,
      startMinute: null,
      endMinute: null,
    }));
    expect(() =>
      addBusinessMinutes(new Date("2026-01-07T10:00:00.000Z"), 10, "UTC", allClosed, []),
    ).toThrow();
  });
});
