import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../common/config/env.validation";
import { AiGatewayService } from "./ai-gateway.service";
import { AI_PROVIDER } from "./ai.constants";
import { AnthropicAiProvider } from "./anthropic-ai-provider";
import { NullAiProvider } from "./null-ai-provider";

/**
 * Owns the `ai` schema — see docs/architecture/03-domain-boundaries.md
 * ("AI Services"). Story 72 — foundation only: no controller, no
 * consumer yet (Stories 80-84). `AI_PROVIDER` is selected once at module
 * init by a factory provider reading `ANTHROPIC_API_KEY`, mirroring
 * `RealtimeGateway`'s own "read required config once, fail closed
 * otherwise" pattern — here "failing closed" means falling back to
 * `NullAiProvider` rather than crashing the whole application over an
 * optional feature.
 */
@Module({
  providers: [
    AnthropicAiProvider,
    NullAiProvider,
    {
      provide: AI_PROVIDER,
      useFactory: (
        configService: ConfigService<EnvConfig, true>,
        anthropicProvider: AnthropicAiProvider,
        nullProvider: NullAiProvider,
      ) => (configService.get("ANTHROPIC_API_KEY", { infer: true }) ? anthropicProvider : nullProvider),
      inject: [ConfigService, AnthropicAiProvider, NullAiProvider],
    },
    AiGatewayService,
  ],
  exports: [AiGatewayService],
})
export class AiModule {}
