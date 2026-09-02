import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { HEALTH_CHECK_QUEUE } from "../queues/health-check.producer";
import { SLA_TIMERS_QUEUE } from "../queues/sla-timers.producer";
import { SLA_TIMER_EVENTS_QUEUE } from "../queues/sla-timer-events-bridge.processor";
import { AI_PROCESSING_QUEUE } from "../queues/ai-processing.producer";
import { AI_PROCESSING_EVENTS_QUEUE } from "../queues/ai-processing-events-bridge.processor";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { MetricsInterceptor } from "./metrics.interceptor";
import { SentryExceptionFilter } from "./sentry-exception.filter";

/**
 * Story 112 — the Prometheus-metrics half of this app's Observability
 * story (see `apps/api/src/tracing.ts` for the OpenTelemetry half).
 * Story 113 additionally registers `SentryExceptionFilter` here (see
 * `../sentry.ts` for the Sentry-init half) — the same module boundary,
 * not a new one, since it's the same Observability concern.
 *
 * Registers its own `BullModule.registerQueue(...)` calls for every queue
 * `QueuesModule` already owns, rather than importing `QueuesModule`
 * itself: `QueuesModule` only exports its three producer *services*
 * (`HealthCheckProducer`/`SlaTimersProducer`/`AiProcessingProducer`), not
 * the raw `Queue` tokens `MetricsService` needs for `getJobCounts()`.
 * Re-registering the same queue name from a second module is a normal,
 * supported `@nestjs/bullmq` pattern — this creates a second, independent
 * `Queue` client against the same Redis-backed queue (the same thing a
 * separate monitoring/dashboard tool would do), not a duplicate queue.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: HEALTH_CHECK_QUEUE },
      { name: SLA_TIMERS_QUEUE },
      { name: SLA_TIMER_EVENTS_QUEUE },
      { name: AI_PROCESSING_QUEUE },
      { name: AI_PROCESSING_EVENTS_QUEUE },
    ),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
  ],
})
export class ObservabilityModule {}
