import { AnthropicAiProvider, NullAiProvider } from "@crm/ai";
import type { AiProvider } from "@crm/ai";

export interface AiProviderFactoryConfig {
  apiKey: string | undefined;
  model: string;
}

/**
 * Architecture-boundary refactor — a plain function, not a NestJS
 * factory provider itself, so it can be unit-tested directly without a
 * DI container: given `apps/worker`'s own validated env values,
 * construct the same `@crm/ai` provider `apps/api`'s `AiModule`
 * constructs from its own env (mirrors that module's `useFactory`
 * shape exactly — see its own doc comment). No `ai-processing` queue or
 * consumer exists yet; this only proves `apps/worker` can depend on and
 * construct `@crm/ai`'s classes from its own configuration.
 */
export function createAiProvider(config: AiProviderFactoryConfig): AiProvider {
  if (!config.apiKey) {
    return new NullAiProvider();
  }
  return new AnthropicAiProvider({ apiKey: config.apiKey, model: config.model });
}
