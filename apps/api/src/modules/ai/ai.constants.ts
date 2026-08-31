/** Injection token for the active `AiProvider` — `AiModule`'s factory
 * provider binds this to `AnthropicAiProvider` or `NullAiProvider` depending
 * on whether `ANTHROPIC_API_KEY` is configured. */
export const AI_PROVIDER = Symbol("AI_PROVIDER");
