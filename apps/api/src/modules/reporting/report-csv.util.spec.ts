import { describe, expect, it } from "vitest";
import { toCsv } from "./report-csv.util";

describe("toCsv", () => {
  it("renders a header row followed by one row per input, comma-separated, CRLF-terminated", () => {
    const csv = toCsv(
      [
        { status: "OPEN", count: 3 },
        { status: "CLOSED", count: 5 },
      ],
      [
        { key: "status", header: "Status" },
        { key: "count", header: "Count" },
      ],
    );

    expect(csv).toBe("Status,Count\r\nOPEN,3\r\nCLOSED,5\r\n");
  });

  it("renders an empty rows array as just the header line", () => {
    const csv = toCsv([], [{ key: "status", header: "Status" }]);

    expect(csv).toBe("Status\r\n");
  });

  it("renders null and undefined fields as empty, never the literal 'null'/'undefined'", () => {
    const csv = toCsv(
      [{ rate: null, average: undefined }],
      [
        { key: "rate", header: "Rate" },
        { key: "average", header: "Average" },
      ],
    );

    expect(csv).toBe("Rate,Average\r\n,\r\n");
  });

  it("quotes a field containing a comma", () => {
    const csv = toCsv([{ name: "Smith, John" }], [{ key: "name", header: "Name" }]);

    expect(csv).toBe('Name\r\n"Smith, John"\r\n');
  });

  it("quotes a field containing a double quote, doubling it", () => {
    const csv = toCsv([{ name: 'The "Best" Agent' }], [{ key: "name", header: "Name" }]);

    expect(csv).toBe('Name\r\n"The ""Best"" Agent"\r\n');
  });

  it("quotes a field containing a newline", () => {
    const csv = toCsv([{ note: "line one\nline two" }], [{ key: "note", header: "Note" }]);

    expect(csv).toBe('Note\r\n"line one\nline two"\r\n');
  });

  it("does not quote a field with no special characters", () => {
    const csv = toCsv([{ value: 42 }], [{ key: "value", header: "Value" }]);

    expect(csv).toBe("Value\r\n42\r\n");
  });
});
