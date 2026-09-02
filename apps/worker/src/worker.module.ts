import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { validateEnv, type EnvConfig } from "./env.validation";
import { HealthProcessor, HEALTH_CHECK_QUEUE } from "./queues/health.processor";
import { SlaTimerProcessor, SLA_TIMERS_QUEUE } from "./queues/sla-timer.processor";
import { SLA_TIMER_EVENTS_QUEUE } from "./queues/sla-timer-events.types";
import { AiProcessingProcessor, AI_PROCESSING_QUEUE } from "./queues/ai-processing.processor";
import { AI_PROCESSING_EVENTS_QUEUE } from "./queues/ai-processing-events.types";
import { PrismaModule } from "./prisma/prisma.module";
import { AiProviderModule } from "./ai/ai-provider.module";
import { PinoLoggerService } from "./common/logging/pino-logger.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
      }),
    }),
    BullModule.registerQueue({ name: HEALTH_CHECK_QUEUE }),
    BullModule.registerQueue({ name: SLA_TIMERS_QUEUE }),
    BullModule.registerQueue({ name: SLA_TIMER_EVENTS_QUEUE }),
    BullModule.registerQueue({ name: AI_PROCESSING_QUEUE }),
    BullModule.registerQueue({ name: AI_PROCESSING_EVENTS_QUEUE }),
    PrismaModule,
    AiProviderModule,
  ],
  providers: [
    HealthProcessor,
    SlaTimerProcessor,
    AiProcessingProcessor,
    // Story 111 — resolved via `app.get(PinoLoggerService)` in `main.ts`.
    PinoLoggerService,
  ],
})
export class WorkerModule {}
