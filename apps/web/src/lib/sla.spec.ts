import { describe, expect, it } from "vitest";
import { deriveSlaStatus, formatRemaining, splitDuration } from "./sla";

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

  // Demo hardening — an agent reply satisfies the response target.
  it("governs by the resolution target once an agent has replied", () => {
    const result = deriveSlaStatus(
      {
        responseTargetAt: "2024-01-01T00:00:00.000Z",
        resolutionTargetAt: "2024-01-05T00:00:00.000Z",
        firstResponseAt: "2023-12-31T23:30:00.000Z",
      },
      now,
    );
    expect(result).toMatchObject({ kind: "on-track", governing: "resolution" });
  });

  // RM-25 — SLA Pause/Resume.
  it("returns 'on-hold' when onHoldSince is set, regardless of where the targets sit", () => {
    const result = deriveSlaStatus(
      {
        // Both targets already in the past — would read as "breached" if
        // the hold check didn't run first.
        responseTargetAt: "2024-01-01T00:00:00.000Z",
        resolutionTargetAt: "2024-01-01T01:00:00.000Z",
        onHoldSince: "2023-12-31T23:00:00.000Z",
      },
      now,
    );
    expect(result).toEqual({ kind: "on-hold", onHoldSince: new Date("2023-12-31T23:00:00.000Z") });
  });

  it("returns 'on-track'/'breached' as before when onHoldSince is null", () => {
    const result = deriveSlaStatus(
      {
        responseTargetAt: "2024-01-01T13:00:00.000Z",
        resolutionTargetAt: "2024-01-02T12:00:00.000Z",
        onHoldSince: null,
      },
      now,
    );
    expect(result.kind).toBe("on-track");
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

/** Story 192 (RD-1.15) — which target governs, and the D3 at-risk tier. */
describe("deriveSlaStatus — governing target and at-risk tier", () => {
  const MIN = 60_000;
  const at = (ms: number) => new Date(now.getTime() + ms).toISOString();

  it("names the earlier target as governing (response, resolution, and response on a tie)", () => {
    const response = deriveSlaStatus(
      { responseTargetAt: at(5 * 60 * MIN), resolutionTargetAt: at(9 * 60 * MIN) },
      now,
    );
    const resolution = deriveSlaStatus(
      { responseTargetAt: at(9 * 60 * MIN), resolutionTargetAt: at(5 * 60 * MIN) },
      now,
    );
    const tie = deriveSlaStatus(
      { responseTargetAt: at(5 * 60 * MIN), resolutionTargetAt: at(5 * 60 * MIN) },
      now,
    );
    expect(response.kind === "on-track" && response.governing).toBe("response");
    expect(resolution.kind === "on-track" && resolution.governing).toBe("resolution");
    expect(tie.kind === "on-track" && tie.governing).toBe("response");
  });

  it("names the governing target of a breach", () => {
    const result = deriveSlaStatus(
      { responseTargetAt: at(9 * 60 * MIN), resolutionTargetAt: at(-MIN) },
      now,
    );
    expect(result).toMatchObject({ kind: "breached", governing: "resolution" });
  });

  it("is at risk at 60 minutes remaining but not at 61 (no creation time)", () => {
    const sixty = deriveSlaStatus(
      { responseTargetAt: at(60 * MIN), resolutionTargetAt: at(600 * MIN) },
      now,
    );
    const sixtyOne = deriveSlaStatus(
      { responseTargetAt: at(61 * MIN), resolutionTargetAt: at(600 * MIN) },
      now,
    );
    expect(sixty).toMatchObject({ kind: "on-track", atRisk: true });
    expect(sixtyOne).toMatchObject({ kind: "on-track", atRisk: false });
  });

  it("is at risk at 25% of the window measured from creation, not just above it", () => {
    // A 10h window: created 7h30m ago with 2h30m left is exactly 25%.
    const target = { responseTargetAt: at(150 * MIN), resolutionTargetAt: at(1000 * MIN) };
    const atQuarter = deriveSlaStatus(target, now, { createdAt: at(-450 * MIN) });
    // Created 7h29m ago: a 9h59m window, 2h30m left is just above 25%.
    const aboveQuarter = deriveSlaStatus(target, now, { createdAt: at(-449 * MIN) });
    expect(atQuarter).toMatchObject({ kind: "on-track", atRisk: true });
    expect(aboveQuarter).toMatchObject({ kind: "on-track", atRisk: false });
  });

  it("applies only the 60-minute rule without a creation time or with a non-positive window", () => {
    const target = { responseTargetAt: at(150 * MIN), resolutionTargetAt: at(1000 * MIN) };
    expect(deriveSlaStatus(target, now)).toMatchObject({ atRisk: false });
    expect(deriveSlaStatus(target, now, { createdAt: at(200 * MIN) })).toMatchObject({
      atRisk: false,
    });
  });
});

describe("splitDuration", () => {
  it("splits whole hours and minutes and returns null under a minute", () => {
    expect(splitDuration(2 * 60 * 60_000 + 15 * 60_000 + 59_000)).toEqual({
      hours: 2,
      minutes: 15,
    });
    expect(splitDuration(45 * 60_000)).toEqual({ hours: 0, minutes: 45 });
    expect(splitDuration(59_999)).toBeNull();
    expect(splitDuration(0)).toBeNull();
    expect(splitDuration(-1)).toBeNull();
  });
});
