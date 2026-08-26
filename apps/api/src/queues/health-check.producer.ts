import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";

/**
 * Must stay identical to `HEALTH_CHECK_QUEUE` in
 * apps/worker/src/queues/health.processor.ts — there is no cross-app
 * shared-constants mechanism in this repository (see Story 14's Context
 * item 8), so this is a deliberately duplicated literal, not an import.
 */
export const HEALTH_CHECK_QUEUE = "health-check";

/**
 * The API-side producer counterpart to apps/worker's existing
 * `HealthProcessor` — the first and, for this story, only BullMQ producer
 * in `apps/api`. Deliberately narrow: one queue, one job shape, one method.
 * A generic multi-queue producer abstraction is not introduced here — no
 * second queue exists yet to generalize across (see this story's Story
 * Goal). Real business queues (`sla-timers`, `notifications`,
 * `integration-sync`, `ai-processing`, `reports-refresh`) are added by the
 * feature stories that need them.
 *
 * Not a fire-and-forget event listener like `SlaTargetListener` — `ping()`
 * lets a failure (e.g. a dropped Redis connection) propagate to its caller
 * rather than catching and logging it, since there is no HTTP request this
 * method must protect.
 */
@Injectable()
export class HealthCheckProducer {
  constructor(@InjectQueue(HEALTH_CHECK_QUEUE) private readonly queue: Queue<{ pingedAt: string }>) {}

  async ping(): Promise<Job<{ pingedAt: string }>> {
    return this.queue.add("ping", { pingedAt: new Date().toISOString() });
  }
}
