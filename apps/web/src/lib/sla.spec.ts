import { describe, expect, it } from "vitest";
import { deriveSlaStatus, formatRemaining } from "./sla";

const now = new Date("2024-01-01T12:00:00.000Z");

describe("deriveSlaStatus", () => {
  it("returns 'none' when there is no SLA target", () => {
    expect(deriveSlaStatus(null, now)).toEqual({ kind: "none" });
  });

  it("returns 'on-track' with the soonest upcoming target when both targets are in the future", () => {
    const result = deriveSlaStatus(
      {
        responseTargetAt: "2024-01-01T13:00:00.000Z",
        resolutionTargetAt: "2024-01-02T12:00:00.000Z",
      },
      now,
    );
    expect(result.kind).toBe("on-track");
    if (result.kind === "on-track") {
      expect(result.remainingMs).toBe(60 * 60_000);
    }
  });

  it("returns 'breached' once the earliest target has passed", () => {
    const result = deriveSlaStatus(
      {
        responseTargetAt: "2024-01-01T11:00:00.000Z",
        resolutionTargetAt: "2024-01-02T12:00:00.000Z",
      },
      now,
    );
    expect(result.kind).toBe("breached");
  });

  it("treats a response target that already passed as breached even if resolution has not", () => {
    const result = deriveSlaStatus(
      {
        responseTargetAt: "2024-01-01T00:00:00.000Z",
        resolutionTargetAt: "2024-01-05T00:00:00.000Z",
      },
      now,
    );
    expect(result.kind).toBe("breached");
  });
});

describe("formatRemaining", () => {
  it("formats minutes only when under an hour", () => {
    expect(formatRemaining(45 * 60_000)).toBe("45m");
  });

  it("formats hours and minutes when an hour or more remains", () => {
    expect(formatRemaining(2 * 60 * 60_000 + 15 * 60_000)).toBe("2h 15m");
  });

  it("formats a non-positive duration as '<1m'", () => {
    expect(formatRemaining(0)).toBe("<1m");
    expect(formatRemaining(-1000)).toBe("<1m");
  });
});
