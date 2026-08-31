import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AnthropicAiProvider, NullAiProvider } from "@crm/ai";
import type { AiProvider } from "@crm/ai";
import type { EnvConfig } from "../../common/config/env.validation";
import { AiGatewayService } from "./ai-gateway.service";
import { AI_PROVIDER } from "./ai.constants";

/**
 * Owns the `ai` schema — see docs/architecture/03-domain-boundaries.md
 * ("AI Services"). Story 72 — foundation only: no controller, no
 * consumer yet (Stories 80-84). `AI_PROVIDER` is selected once at module
 * init by a factory provider reading `ANTHROPIC_API_KEY`, mirroring
 * `RealtimeGateway`'s own "read required config once, fail closed
 * otherwise" pattern — here "failing closed" means falling back to
 * `NullAiProvider` rather than crashing the whole application over an
 * optional feature.
 *
 * Architecture-boundary refactor — `AnthropicAiProvider`/`NullAiProvider`
 * now live in the framework-neutral `@crm/ai` package (no `@Injectable()`
 * of their own), so the factory constructs the right one directly with
 * this app's own validated `ConfigService` values, rather than injecting
 * them as separate Nest providers the way Story 72 originally did.
 * `apps/worker` mirrors this same factory shape with its own env values
 * (`apps/worker/src/ai/ai-provider.factory.ts`) — see that file's own
 * doc comment.
 */
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (configService: ConfigService<EnvConfig, true>): AiProvider => {
        const apiKey = configService.get("ANTHROPIC_API_KEY", { infer: true });
        if (!apiKey) {
          return new NullAiProvider();
        }
        const model = configService.get("ANTHROPIC_MODEL", { infer: true });
        return new AnthropicAiProvider({ apiKey, model });
      },
      inject: [ConfigService],
    },
    AiGatewayService,
  ],
  exports: [AiGatewayService],
})
export class AiModule {}
