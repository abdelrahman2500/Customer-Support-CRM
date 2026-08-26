import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../common/config/env.validation";
import { HealthCheckProducer, HEALTH_CHECK_QUEUE } from "./health-check.producer";

/**
 * Owns `apps/api`'s BullMQ producer connection — the API-side counterpart
 * to `apps/worker/src/worker.module.ts`'s `BullModule.forRootAsync`/
 * `BullModule.registerQueue` pair. Registers the **existing** `health-check`
 * queue only; no new queue name is introduced.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
      }),
    }),
    BullModule.registerQueue({ name: HEALTH_CHECK_QUEUE }),
  ],
  providers: [HealthCheckProducer],
  exports: [HealthCheckProducer],
})
export class QueuesModule {}
