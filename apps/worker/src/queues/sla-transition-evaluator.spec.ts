import { describe, expect, it } from "vitest";
import { evaluateTransition } from "./sla-transition-evaluator";

describe("evaluateTransition", () => {
  const targetAt = new Date("2026-01-01T10:00:00.000Z");
  const targetMinutes = 100; // at-risk threshold = 20 minutes before targetAt = 09:40:00Z

  it("returns none well before the at-risk threshold", () => {
    const result = evaluateTransition({
      now: new Date("2026-01-01T09:00:00.000Z"),
      targetAt,
      targetMinutes,
      alreadyAtRiskNotified: false,
      alreadyBreachedNotified: false,
    });
    expect(result).toBe("none");
  });

  it("returns at_risk exactly at the threshold instant", () => {
    const result = evaluateTransition({
      now: new Date("2026-01-01T09:40:00.000Z"),
      targetAt,
      targetMinutes,
      alreadyAtRiskNotified: false,
      alreadyBreachedNotified: false,
    });
    expect(result).toBe("at_risk");
  });

  it("returns none once already at-risk-notified but still before targetAt", () => {
    const result = evaluateTransition({
      now: new Date("2026-01-01T09:45:00.000Z"),
      targetAt,
      targetMinutes,
      alreadyAtRiskNotified: true,
      alreadyBreachedNotified: false,
    });
    expect(result).toBe("none");
  });

  it("returns breach exactly at targetAt", () => {
    const result = evaluateTransition({
      now: targetAt,
      targetAt,
      targetMinutes,
      alreadyAtRiskNotified: true,
      alreadyBreachedNotified: false,
    });
    expect(result).toBe("breach");
  });

  it("returns breach after targetAt", () => {
    const result = evaluateTransition({
      now: new Date("2026-01-01T11:00:00.000Z"),
      targetAt,
      targetMinutes,
      alreadyAtRiskNotified: true,
      alreadyBreachedNotified: false,
    });
    expect(result).toBe("breach");
  });

  it("returns none once already breached-notified, even long after targetAt", () => {
    const result = evaluateTransition({
      now: new Date("2026-01-02T00:00:00.000Z"),
      targetAt,
      targetMinutes,
      alreadyAtRiskNotified: true,
      alreadyBreachedNotified: true,
    });
    expect(result).toBe("none");
  });

  it("returns breach, not at_risk, for a direct not-at-risk-to-breached transition", () => {
    // now is past both the at-risk threshold (09:40) and targetAt (10:00),
    // and neither has ever been notified — the very first time this target
    // is evaluated at all (e.g. after the worker was down for a while).
    const result = evaluateTransition({
      now: new Date("2026-01-01T12:00:00.000Z"),
      targetAt,
      targetMinutes,
      alreadyAtRiskNotified: false,
      alreadyBreachedNotified: false,
    });
    expect(result).toBe("breach");
  });

  it("never returns at_risk once breach is reached, regardless of at-risk notified state", () => {
    const result = evaluateTransition({
      now: new Date("2026-01-01T10:00:01.000Z"),
      targetAt,
      targetMinutes,
      alreadyAtRiskNotified: false,
      alreadyBreachedNotified: false,
    });
    expect(result).toBe("breach");
  });
});
