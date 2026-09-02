import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { HEALTH_CHECK_QUEUE } from "../queues/health-check.producer";
import { SLA_TIMERS_QUEUE } from "../queues/sla-timers.producer";
import { SLA_TIMER_EVENTS_QUEUE } from "../queues/sla-timer-events-bridge.processor";
import { AI_PROCESSING_QUEUE } from "../queues/ai-processing.producer";
import { AI_PROCESSING_EVENTS_QUEUE } from "../queues/ai-processing-events-bridge.processor";

/** The BullMQ job states this service reports a gauge for — the
 * operationally interesting ones ("completed" is intentionally excluded:
 * unbounded and not itself a queue-health signal the way a growing
 * "waiting"/"failed" count is). */
const JOB_STATES = ["waiting", "active", "delayed", "failed"] as const;

/** `[queue name, injected Queue instance]` pairs — every queue this app's
 * own `QueuesModule` registers (see that module's own doc comment for the
 * full producer/bridge-processor list this mirrors). */
type QueueEntry = readonly [name: string, queue: Queue];

/**
 * Story 112 — docs/architecture/11-quality-and-operations.md:
 * "Prometheus-format `/metrics` endpoints expose request, queue, and
 * processing metrics for Grafana dashboards." Owns this app's single
 * `prom-client` `Registry` (`MetricsController` renders it; `MetricsInterceptor`
 * feeds it HTTP request timings — see both files' own doc comments).
 *
 * Queue-depth gauges are refreshed on demand (`refreshQueueGauges()`,
 * called from `render()` immediately before serializing) rather than on a
 * timer: a Prometheus scrape is already the "give me current state" event,
 * so there is no reason to poll Redis between scrapes just to keep a
 * gauge warm.
 *
 * `apps/worker`'s own job-processing metrics (duration/success/failure
 * per job) are deliberately NOT exposed here — `apps/worker` has no HTTP
 * listener at all today (see `apps/worker/src/main.ts`'s own doc
 * comment), and giving it one is a separate architectural decision this
 * story does not make (see this story's plan doc, "Non-goals"). Queue
 * *depth* is still fully observable from here, since both apps share the
 * same Redis-backed queues.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly httpRequestDuration: Histogram<"method" | "route" | "status_code">;
  private readonly queueJobs: Gauge<"queue" | "state">;
  private readonly queues: readonly QueueEntry[];

  constructor(
    @InjectQueue(HEALTH_CHECK_QUEUE) healthCheckQueue: Queue,
    @InjectQueue(SLA_TIMERS_QUEUE) slaTimersQueue: Queue,
    @InjectQueue(SLA_TIMER_EVENTS_QUEUE) slaTimerEventsQueue: Queue,
    @InjectQueue(AI_PROCESSING_QUEUE) aiProcessingQueue: Queue,
    @InjectQueue(AI_PROCESSING_EVENTS_QUEUE) aiProcessingEventsQueue: Queue,
  ) {
    this.queues = [
      [HEALTH_CHECK_QUEUE, healthCheckQueue],
      [SLA_TIMERS_QUEUE, slaTimersQueue],
      [SLA_TIMER_EVENTS_QUEUE, slaTimerEventsQueue],
      [AI_PROCESSING_QUEUE, aiProcessingQueue],
      [AI_PROCESSING_EVENTS_QUEUE, aiProcessingEventsQueue],
    ];

    collectDefaultMetrics({ register: this.registry });

    this.httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "Duration of HTTP requests in seconds",
      labelNames: ["method", "route", "status_code"],
      registers: [this.registry],
    });

    this.queueJobs = new Gauge({
      name: "bullmq_queue_jobs",
      help: "Current BullMQ job count per queue and state",
      labelNames: ["queue", "state"],
      registers: [this.registry],
    });
  }

  /** Called by `MetricsInterceptor` after every HTTP request completes
   * (success or error alike — a slow/failing request is exactly the kind
   * this metric exists to surface). */
  observeHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    this.httpRequestDuration.observe(
      { method, route, status_code: String(statusCode) },
      durationSeconds,
    );
  }

  /** Renders the full registry in Prometheus text format, refreshing the
   * queue-depth gauges immediately beforehand. */
  async render(): Promise<string> {
    await this.refreshQueueGauges();
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  private async refreshQueueGauges(): Promise<void> {
    await Promise.all(
      this.queues.map(async ([name, queue]) => {
        const counts = await queue.getJobCounts(...JOB_STATES);
        for (const state of JOB_STATES) {
          this.queueJobs.set({ queue: name, state }, counts[state] ?? 0);
        }
      }),
    );
  }
}
