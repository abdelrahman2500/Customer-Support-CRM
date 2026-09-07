import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../common/config/env.validation";
import { HealthCheckProducer, HEALTH_CHECK_QUEUE } from "./health-check.producer";
import { SlaTimersProducer, SLA_TIMERS_QUEUE } from "./sla-timers.producer";
import { SlaTimerEventsBridgeProcessor, SLA_TIMER_EVENTS_QUEUE } from "./sla-timer-events-bridge.processor";
import { AiProcessingProducer, AI_PROCESSING_QUEUE } from "./ai-processing.producer";
import { AiProcessingEventsBridgeProcessor, AI_PROCESSING_EVENTS_QUEUE } from "./ai-processing-events-bridge.processor";
import { TaskRemindersProducer, TASK_REMINDERS_QUEUE } from "./task-reminders.producer";
import { TaskReminderEventsBridgeProcessor, TASK_REMINDER_EVENTS_QUEUE } from "./task-reminder-events-bridge.processor";
import { ChannelMessageDeliveryProducer, CHANNEL_MESSAGE_DELIVERY_QUEUE } from "./channel-message-delivery.producer";
import {
  ChannelMessageDeliveryEventsBridgeProcessor,
  CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE,
} from "./channel-message-delivery-events-bridge.processor";
import {
  PortalNotificationEmailProducer,
  PORTAL_NOTIFICATION_EMAIL_QUEUE,
} from "./portal-notification-email.producer";
import { WebhookDispatchProducer, WEBHOOK_DISPATCH_QUEUE } from "./webhook-dispatch.producer";

/**
 * Owns `apps/api`'s BullMQ producer connection — one place all of
 * `apps/api`'s queue registrations live (Story 14's own convention).
 * `health-check` is unchanged. `sla-timers` (produced here, consumed by
 * `apps/worker`) and `sla-timer-events` (consumed here, produced by
 * `apps/worker`) are Story 15's narrow SLA hand-back bridge.
 *
 * Story 76 — `ai-processing` (produced here, consumed by `apps/worker`)
 * and `ai-processing-events` (consumed here, produced by `apps/worker`)
 * are the identically-shaped AI hand-back bridge.
 *
 * RM-03 — `task-reminders` (produced here, consumed by `apps/worker`) and
 * `task-reminder-events` (consumed here, produced by `apps/worker`) are
 * the identically-shaped task-reminder hand-back bridge.
 *
 * RM-13 — `channel-message-delivery` (produced here, consumed by
 * `apps/worker`) and `channel-message-delivery-events` (consumed here,
 * produced by `apps/worker`) are the identically-shaped channel-delivery
 * hand-back bridge — see `ChannelMessageDeliveryProducer`'s own doc
 * comment for why this is also the queue that introduces this
 * repository's first configured `attempts`/`backoff` retry policy.
 *
 * RM-19 — `portal-notification-email` (produced here, consumed by
 * `apps/worker`) has no hand-back queue of its own: a notification email
 * has nothing for the worker to report back for realtime relay (unlike
 * `channel-message-delivery`'s `SENT`/`FAILED` status, there is no
 * corresponding UI state anywhere that changes when this send succeeds
 * or fails) — one-directional, api → worker only.
 *
 * RM-20 — `webhook-dispatch` (produced here, consumed by `apps/worker`) is
 * the same one-directional shape as `portal-notification-email`: the
 * worker durably records every attempt itself
 * (`WebhookDeliveryAttempt`, via its own `PrismaService`, mirroring
 * `ChannelMessageDeliveryProcessor`'s convention), so there is nothing left
 * for `apps/api` to be handed back.
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
    BullModule.registerQueue({ name: AI_PROCESSING_QUEUE }),
    BullModule.registerQueue({ name: AI_PROCESSING_EVENTS_QUEUE }),
    BullModule.registerQueue({ name: TASK_REMINDERS_QUEUE }),
    BullModule.registerQueue({ name: TASK_REMINDER_EVENTS_QUEUE }),
    BullModule.registerQueue({ name: CHANNEL_MESSAGE_DELIVERY_QUEUE }),
    BullModule.registerQueue({ name: CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE }),
    BullModule.registerQueue({ name: PORTAL_NOTIFICATION_EMAIL_QUEUE }),
    BullModule.registerQueue({ name: WEBHOOK_DISPATCH_QUEUE }),
  ],
  providers: [
    HealthCheckProducer,
    SlaTimersProducer,
    SlaTimerEventsBridgeProcessor,
    AiProcessingProducer,
    AiProcessingEventsBridgeProcessor,
    TaskRemindersProducer,
    TaskReminderEventsBridgeProcessor,
    ChannelMessageDeliveryProducer,
    ChannelMessageDeliveryEventsBridgeProcessor,
    PortalNotificationEmailProducer,
    WebhookDispatchProducer,
  ],
  exports: [
    HealthCheckProducer,
    SlaTimersProducer,
    AiProcessingProducer,
    TaskRemindersProducer,
    ChannelMessageDeliveryProducer,
    PortalNotificationEmailProducer,
    WebhookDispatchProducer,
  ],
})
export class QueuesModule {}
