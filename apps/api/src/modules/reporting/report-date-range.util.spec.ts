import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { hasDateRange, resolveReportDateRange } from "./report-date-range.util";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("resolveReportDateRange", () => {
  it("returns an empty filter when both from and to are omitted", () => {
    expect(resolveReportDateRange()).toEqual({});
  });

  it("returns only gte, at UTC midnight, when only from is supplied", () => {
    const result = resolveReportDateRange("2026-01-15");
    expect(result).toEqual({ gte: new Date("2026-01-15T00:00:00.000Z") });
    expect(result.lt).toBeUndefined();
  });

  it("returns only lt, one day past to's UTC midnight, when only to is supplied", () => {
    const result = resolveReportDateRange(undefined, "2026-01-15");
    expect(result.gte).toBeUndefined();
    expect(result.lt).toEqual(new Date("2026-01-16T00:00:00.000Z"));
  });

  it("returns both gte and the exclusive next-day lt when from and to are both supplied", () => {
    const result = resolveReportDateRange("2026-01-01", "2026-01-31");
    expect(result).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lt: new Date("2026-02-01T00:00:00.000Z"),
    });
  });

  it("treats from === to as a valid, one-day-wide window", () => {
    const result = resolveReportDateRange("2026-06-15", "2026-06-15");
    expect(result.lt!.getTime() - result.gte!.getTime()).toBe(MS_PER_DAY);
  });

  it("throws BadRequestException when from is after to", () => {
    expect(() => resolveReportDateRange("2026-02-01", "2026-01-01")).toThrow(BadRequestException);
  });

  it("rejects a shape-valid but non-existent calendar date (2026-02-30), which new Date() would otherwise silently roll over to March", () => {
    expect(new Date("2026-02-30").getUTCMonth()).toBe(2); // sanity check on the underlying risk: rolls to March (month index 2)
    expect(() => resolveReportDateRange("2026-02-30")).toThrow(BadRequestException);
    expect(() => resolveReportDateRange(undefined, "2026-02-30")).toThrow(BadRequestException);
  });

  it("rejects a shape-valid but non-existent day-of-month (2026-01-32)", () => {
    expect(() => resolveReportDateRange("2026-01-32")).toThrow(BadRequestException);
  });

  it("accepts a real leap-day date (2024-02-29)", () => {
    expect(() => resolveReportDateRange("2024-02-29")).not.toThrow();
  });

  it("rejects a non-existent leap-day on a non-leap year (2026-02-29)", () => {
    expect(() => resolveReportDateRange("2026-02-29")).toThrow(BadRequestException);
  });
});

describe("hasDateRange", () => {
  it("is false for an empty filter", () => {
    expect(hasDateRange({})).toBe(false);
  });

  it("is true when gte is present", () => {
    expect(hasDateRange({ gte: new Date() })).toBe(true);
  });

  it("is true when lt is present", () => {
    expect(hasDateRange({ lt: new Date() })).toBe(true);
  });
});
