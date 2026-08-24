import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

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
}
