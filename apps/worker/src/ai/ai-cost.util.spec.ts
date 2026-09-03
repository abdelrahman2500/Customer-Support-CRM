import { describe, expect, it } from "vitest";
import { computeCostMicroUsd } from "./ai-cost.util";

describe("computeCostMicroUsd", () => {
  it("returns null when inputTokens is null (call never completed with billable usage)", () => {
    expect(computeCostMicroUsd("claude-sonnet-4-5-20250929", null, 100)).toBeNull();
  });

  it("returns null when outputTokens is null", () => {
    expect(computeCostMicroUsd("claude-sonnet-4-5-20250929", 100, null)).toBeNull();
  });

  it("returns null for an unrecognized/unpriced model, never a fabricated 0", () => {
    expect(computeCostMicroUsd("some-future-model-2099", 1000, 1000)).toBeNull();
  });

  it("computes the exact micro-USD cost for a known sonnet-family model", () => {
    // 1,000,000 input tokens at $3/M + 1,000,000 output tokens at $15/M
    // = $3 + $15 = $18 = 18,000,000 micro-USD.
    expect(computeCostMicroUsd("claude-sonnet-4-5-20250929", 1_000_000, 1_000_000)).toBe(
      18_000_000,
    );
  });

  it("computes the exact micro-USD cost for a known opus-family model", () => {
    // 1,000,000 input tokens at $15/M + 1,000,000 output tokens at $75/M
    // = $15 + $75 = $90 = 90,000,000 micro-USD.
    expect(computeCostMicroUsd("claude-opus-4-1-20250805", 1_000_000, 1_000_000)).toBe(
      90_000_000,
    );
  });

  it("computes the exact micro-USD cost for a known haiku-family model", () => {
    // 1,000,000 input tokens at $0.8/M + 1,000,000 output tokens at $4/M
    // = $0.8 + $4 = $4.8 = 4,800,000 micro-USD.
    expect(computeCostMicroUsd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000)).toBe(
      4_800_000,
    );
  });

  it("computes a correctly-rounded small cost for realistic token counts", () => {
    // 500 input tokens at $3/M + 200 output tokens at $15/M
    // = (500 * 3) + (200 * 15) = 1500 + 3000 = 4500 micro-USD.
    expect(computeCostMicroUsd("claude-sonnet-4-5-20250929", 500, 200)).toBe(4500);
  });

  it("matches by model family prefix, not exact snapshot id", () => {
    expect(computeCostMicroUsd("claude-sonnet-3-5-20241022", 1_000_000, 0)).toBe(3_000_000);
  });

  it("returns 0, not null, when both token counts are legitimately 0 for a priced model", () => {
    expect(computeCostMicroUsd("claude-sonnet-4-5-20250929", 0, 0)).toBe(0);
  });
});
