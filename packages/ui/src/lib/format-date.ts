/**
 * Story 194 (RD-1.17) — the one place a date becomes text. Replaces 29
 * inline `toLocale*String` calls across both apps (a guard spec keeps them
 * out). Translation-free: `Intl` supplies every word, and the caller passes
 * the active UI locale, which stays the app's concern.
 *
 * Each formatter uses exactly the options its `toLocale*String` counterpart
 * defaults to (ECMA-402 `ToDateTimeOptions`), so English output is
 * unchanged. Arabic follows whatever `Intl` gives `ar` — decision D4 keeps
 * that behaviour and this module never picks a numbering system. No time
 * zone is passed: the runtime's applies, as before. `locale` may be
 * `undefined` (the runtime default), which is what the old locale-less calls
 * did.
 */
export type DateInput = string | number | Date;

const DATE_TIME: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
};
const DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

/** What `Date.prototype.toLocaleString` returns for an invalid date; `Intl`
 * would throw a RangeError instead. */
const INVALID_DATE = "Invalid Date";

const formatters = new Map<string, Intl.DateTimeFormat>();

function format(
  value: DateInput,
  locale: string | undefined,
  kind: string,
  options: Intl.DateTimeFormatOptions,
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return INVALID_DATE;
  }
  const key = `${locale ?? ""}|${kind}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter.format(date);
}

/** Date and time — what `toLocaleString(locale)` printed. */
export function formatDateTime(value: DateInput, locale: string | undefined): string {
  return format(value, locale, "datetime", DATE_TIME);
}

/** Date only — what `toLocaleDateString(locale)` printed. */
export function formatDate(value: DateInput, locale: string | undefined): string {
  return format(value, locale, "date", DATE);
}

/** Hours and minutes — the chat cards' former
 * `toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })`. */
export function formatTime(value: DateInput, locale: string | undefined): string {
  return format(value, locale, "time", TIME);
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60_000],
  ["month", 30 * 24 * 60 * 60_000],
  ["week", 7 * 24 * 60 * 60_000],
  ["day", 24 * 60 * 60_000],
  ["hour", 60 * 60_000],
  ["minute", 60_000],
];

const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

/**
 * Relative to `now` ("5 minutes ago", "tomorrow", "قبل ٥ دقائق"), in the
 * largest whole unit that fits; `numeric: "auto"` lets `Intl` say
 * "yesterday"/"now". For RD-3.x's thread; no existing site renders it.
 */
export function formatRelative(
  value: DateInput,
  locale: string | undefined,
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return INVALID_DATE;
  }
  const key = locale ?? "";
  let formatter = relativeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeFormatters.set(key, formatter);
  }
  const diffMs = date.getTime() - now.getTime();
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(diffMs) >= unitMs) {
      return formatter.format(Math.trunc(diffMs / unitMs), unit);
    }
  }
  return formatter.format(Math.trunc(diffMs / 1000), "second");
}
