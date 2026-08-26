import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

/**
 * Must stay identical to `SLA_TIMERS_QUEUE` in
 * apps/worker/src/queues/sla-timer.processor.ts — no cross-app
 * shared-constants mechanism exists in this repository (see Story 14's
 * precedent for `HEALTH_CHECK_QUEUE`), so this is a deliberately
 * duplicated literal, not an import.
 */
export const SLA_TIMERS_QUEUE = "sla-timers";

const SLA_TIMER_SCHEDULER_ID = "sla-timers-scheduler";
const SLA_TIMER_INTERVAL_MS = 60_000;

/**
 * Registers the recurring `sla-timers` scheduler on module init, using
 * BullMQ's current Job Scheduler API (`upsertJobScheduler`) — not the
 * deprecated direct-repeatable-job pattern. `upsertJobScheduler` is
 * idempotent by construction: calling it again with the same
 * `SLA_TIMER_SCHEDULER_ID` and the same repeat options updates the
 * existing scheduler rather than creating a second one, so no additional
 * duplicate-prevention logic is needed here — this is what "idempotent
 * scheduler registration" means for this API, verified against the
 * installed `bullmq@6.2.0` type declarations before writing this plan.
 */
@Injectable()
export class SlaTimersProducer implements OnModuleInit {
  private readonly logger = new Logger(SlaTimersProducer.name);

  constructor(@InjectQueue(SLA_TIMERS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(SLA_TIMER_SCHEDULER_ID, { every: SLA_TIMER_INTERVAL_MS }, { name: "check" });
    this.logger.log(`Registered sla-timers scheduler (every ${SLA_TIMER_INTERVAL_MS}ms)`);
  }
}
