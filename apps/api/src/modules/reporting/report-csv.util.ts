/** One output column: `key` selects the field off each row, `header` is
 * its column title in the CSV's first line. */
export interface CsvColumn<T> {
  key: keyof T;
  header: string;
}

/**
 * Story 125 — Reporting Export. RFC-4180-minimal CSV serialization, shared
 * by every `GET /reports/*` export route (mirrors this module's own
 * `report-date-range.util.ts` precedent: one small reusable utility, not a
 * bespoke serializer per report). A field containing a comma, double
 * quote, or newline is wrapped in double quotes with internal quotes
 * doubled; every row (including the header) ends in `\r\n`.
 *
 * `null`/`undefined` render as an empty field — never the literal strings
 * "null"/"undefined" a naive `String(value)` would produce. This matters
 * here specifically: several report fields are deliberately `null` to mean
 * "no data yet, not zero" (e.g. `SlaComplianceSummary.complianceRate`,
 * `CsatSummary.averageRating`) — that meaning must survive into the CSV
 * unchanged, not get silently coerced into a misleading value.
 */
export function toCsv<T>(rows: T[], columns: Array<CsvColumn<T>>): string {
  const lines = [
    columns.map((column) => escapeCsvField(column.header)),
    ...rows.map((row) => columns.map((column) => escapeCsvField(row[column.key]))),
  ].map((fields) => fields.join(","));
  return lines.map((line) => `${line}\r\n`).join("");
}

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}
