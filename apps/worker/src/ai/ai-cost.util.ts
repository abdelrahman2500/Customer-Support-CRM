/**
 * Story 121 — AI Usage/Cost Reporting. A manually-maintained price table —
 * no live Anthropic pricing API call (this story's own explicit
 * non-goal), mirroring `docs/architecture/08-supporting-domains.md`'s
 * "no premature infrastructure" reporting convention. Keyed by model
 * *family prefix*, not exact snapshot id: `AiCallResult.model` is always
 * the exact dated snapshot Anthropic returns (e.g.
 * `"claude-sonnet-4-5-20250929"`), never the bare family name.
 *
 * This table must be updated whenever `ANTHROPIC_MODEL`
 * (`apps/worker/src/env.validation.ts`) moves to a new model family — an
 * unmapped model computes a `null` cost (see `computeCostMicroUsd` below),
 * never a fabricated `0` or an incorrect guess.
 *
 * Prices are official Anthropic list prices, USD per million tokens, as of
 * this story's implementation — first-party, publicly published rates,
 * not estimates.
 */
export interface ModelPricing {
  inputPerMillionTokensUsd: number;
  outputPerMillionTokensUsd: number;
}

const MODEL_PRICING: ReadonlyArray<readonly [prefix: string, pricing: ModelPricing]> = [
  ["claude-opus", { inputPerMillionTokensUsd: 15, outputPerMillionTokensUsd: 75 }],
  ["claude-sonnet", { inputPerMillionTokensUsd: 3, outputPerMillionTokensUsd: 15 }],
  ["claude-haiku", { inputPerMillionTokensUsd: 0.8, outputPerMillionTokensUsd: 4 }],
];

function findPricing(model: string): ModelPricing | undefined {
  return MODEL_PRICING.find(([prefix]) => model.startsWith(prefix))?.[1];
}

/**
 * Integer micro-USD (1,000,000 = $1) — see `AiPromptLog.costMicroUsd`'s
 * own schema doc comment for why this avoids float dollar amounts.
 * `null` whenever either token count is `null` (the call never completed
 * with billable usage — PENDING/ERROR/DISABLED) or `model` has no entry
 * in `MODEL_PRICING` — never a fabricated `0` in either case, since a
 * `0` would read as "this call was free," not "this call's cost is
 * unknown."
 *
 * `pricing.*PerMillionTokensUsd` is USD per 1,000,000 tokens; 1 USD is
 * 1,000,000 micro-USD — the two factors of 1,000,000 cancel exactly, so
 * `tokens * pricePerMillionTokensUsd` is already the cost in micro-USD,
 * with no intermediate division (and so no intermediate float-rounding
 * step) needed.
 */
export function computeCostMicroUsd(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (inputTokens === null || outputTokens === null) {
    return null;
  }
  const pricing = findPricing(model);
  if (!pricing) {
    return null;
  }
  return Math.round(
    inputTokens * pricing.inputPerMillionTokensUsd +
      outputTokens * pricing.outputPerMillionTokensUsd,
  );
}
