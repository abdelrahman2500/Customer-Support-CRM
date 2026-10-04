import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatRelative, formatTime } from "./format-date";

/**
 * Story 194 (RD-1.17) — each formatter must print exactly what the inline
 * `toLocale*String` call it replaced printed, in both UI locales, so no
 * converted site changes its English output and Arabic keeps today's `Intl`
 * behaviour (decision D4).
 */
const DATES = [
  new Date("2026-01-05T00:00:00"),
  new Date("2026-06-15T12:00:00"),
  new Date("2026-10-04T17:17:59"),
  new Date("2026-12-31T23:59:59"),
];

describe("format-date", () => {
  for (const locale of ["en", "ar"]) {
    it(`matches toLocaleString / toLocaleDateString / toLocaleTimeString for ${locale}`, () => {
      for (const date of DATES) {
        expect(formatDateTime(date, locale)).toBe(date.toLocaleString(locale));
        expect(formatDate(date, locale)).toBe(date.toLocaleDateString(locale));
        expect(formatTime(date, locale)).toBe(
          date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
        );
      }
    });
  }

  it("uses the runtime default for an undefined locale, like the old locale-less calls", () => {
    for (const date of DATES) {
      expect(formatDateTime(date, undefined)).toBe(date.toLocaleString());
      expect(formatDate(date, undefined)).toBe(date.toLocaleDateString());
    }
  });

  it("accepts ISO strings, timestamps and Date objects alike", () => {
    const date = DATES[2]!;
    const expected = formatDateTime(date, "en");
    expect(formatDateTime(date.toISOString(), "en")).toBe(expected);
    expect(formatDateTime(date.getTime(), "en")).toBe(expected);
  });

  it("returns 'Invalid Date' for an unparsable value instead of throwing", () => {
    expect(formatDateTime("not a date", "en")).toBe("Invalid Date");
    expect(formatDate("", "ar")).toBe("Invalid Date");
    expect(formatTime(Number.NaN, "en")).toBe("Invalid Date");
    expect(formatRelative("nope", "en")).toBe("Invalid Date");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const offset = (ms: number) => new Date(now.getTime() + ms);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  it("uses seconds under a minute and minutes from 60 seconds", () => {
    expect(formatRelative(offset(-59_000), "en", now)).toBe(rtf.format(-59, "second"));
    expect(formatRelative(offset(-60_000), "en", now)).toBe(rtf.format(-1, "minute"));
  });

  it("picks the largest whole unit, past and future", () => {
    expect(formatRelative(offset(-3 * 60 * 60_000), "en", now)).toBe("3 hours ago");
    expect(formatRelative(offset(-24 * 60 * 60_000), "en", now)).toBe("yesterday");
    expect(formatRelative(offset(2 * 7 * 24 * 60 * 60_000), "en", now)).toBe("in 2 weeks");
    expect(formatRelative(offset(-40 * 24 * 60 * 60_000), "en", now)).toBe("last month");
    expect(formatRelative(offset(-800 * 24 * 60 * 60_000), "en", now)).toBe("2 years ago");
  });

  it("speaks the given locale", () => {
    const ar = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
    expect(formatRelative(offset(-3 * 60 * 60_000), "ar", now)).toBe(ar.format(-3, "hour"));
    expect(formatRelative(offset(-3 * 60 * 60_000), "ar", now)).not.toMatch(/[A-Za-z]/);
  });
});
