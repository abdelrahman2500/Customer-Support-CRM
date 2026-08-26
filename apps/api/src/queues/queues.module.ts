import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../common/config/env.validation";
import { HealthCheckProducer, HEALTH_CHECK_QUEUE } from "./health-check.producer";
import { SlaTimersProducer, SLA_TIMERS_QUEUE } from "./sla-timers.producer";
import { SlaTimerEventsBridgeProcessor, SLA_TIMER_EVENTS_QUEUE } from "./sla-timer-events-bridge.processor";

/**
 * Owns `apps/api`'s BullMQ producer connection — one place all of
 * `apps/api`'s queue registrations live (Story 14's own convention).
 * `health-check` is unchanged. `sla-timers` (produced here, consumed by
 * `apps/worker`) and `sla-timer-events` (consumed here, produced by
 * `apps/worker`) are Story 15's narrow SLA hand-back bridge.
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
    BullModule.registerQueue({ name: SLA_TIMERS_QUEUE }),
    BullModule.registerQueue({ name: SLA_TIMER_EVENTS_QUEUE }),
  ],
  providers: [HealthCheckProducer, SlaTimersProducer, SlaTimerEventsBridgeProcessor],
  exports: [HealthCheckProducer, SlaTimersProducer],
})
export class QueuesModule {}
