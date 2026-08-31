import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../env.validation";
import { AI_PROVIDER } from "./ai.constants";
import { createAiProvider } from "./ai-provider.factory";

/**
 * Architecture-boundary refactor (prep only) — proves `apps/worker` can
 * depend on `@crm/ai` and construct `AnthropicAiProvider`/
 * `NullAiProvider` from its own, independently-validated env, mirroring
 * `apps/api`'s `AiModule` factory shape exactly. Registering this module
 * in `WorkerModule` makes Nest actually construct `AI_PROVIDER` at boot
 * (a real smoke test, not just a type-checks-but-never-runs claim) —
 * today that always resolves to `NullAiProvider`, since no
 * `ANTHROPIC_API_KEY` exists in this environment.
 *
 * Deliberately does not export anything beyond `AI_PROVIDER` and has no
 * consumer yet: no `ai-processing` queue, producer, processor, or
 * hand-back event exists — that is a separate future corrective story
 * (see the "AI Async Architecture Recon" report). This module exists
 * only to establish that the shared provider boundary works from the
 * worker side.
 */
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (configService: ConfigService<EnvConfig, true>) =>
        createAiProvider({
          apiKey: configService.get("ANTHROPIC_API_KEY", { infer: true }),
          model: configService.get("ANTHROPIC_MODEL", { infer: true }),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiProviderModule {}
