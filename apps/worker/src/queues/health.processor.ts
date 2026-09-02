import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import * as Sentry from "@sentry/node";

export const HEALTH_CHECK_QUEUE = "health-check";

/**
 * Trivial processor whose only purpose is to prove `apps/worker` has a
 * working BullMQ/Redis connection (see Story 02's verification steps).
 * Real queues (`sla-timers`, `notifications`, `integration-sync`,
 * `ai-processing`, `reports-refresh`) are registered by the feature stories
 * that need them — see docs/architecture/06-communication-and-realtime.md.
 */
@Processor(HEALTH_CHECK_QUEUE)
export class HealthProcessor extends WorkerHost {
  private readonly logger = new Logger(HealthProcessor.name);

  async process(job: Job<{ pingedAt: string }>): Promise<{ pongedAt: string }> {
    this.logger.log(`Processed ${job.name} (pinged at ${job.data.pingedAt})`);
    return { pongedAt: new Date().toISOString() };
  }

  /** Story 113 — see `SlaTimerProcessor.onFailed`'s own doc comment for
   * why this is a real, actionable capture point (this processor also
   * has no try/catch). */
  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    Sentry.captureException(error, { tags: { queue: HEALTH_CHECK_QUEUE, jobId: job?.id } });
  }
}
