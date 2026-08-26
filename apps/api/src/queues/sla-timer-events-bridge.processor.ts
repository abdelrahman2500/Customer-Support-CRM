import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";
import {
  SLA_AT_RISK_EVENT,
  SLA_BREACHED_EVENT,
  type SlaAtRiskEvent,
  type SlaBreachedEvent,
  type SlaTargetType,
} from "../modules/sla-policies/sla-detection.events";

/**
 * The dedicated worker-to-api SLA hand-back queue — apps/worker's
 * `SlaTimerProcessor` (apps/worker/src/queues/sla-timer.processor.ts) is
 * this queue's producer and duplicates this literal with a cross-reference
 * comment, the same convention Story 14 established for
 * `HEALTH_CHECK_QUEUE`. Not a generic event bus — this queue carries only
 * SLA detection results.
 */
export const SLA_TIMER_EVENTS_QUEUE = "sla-timer-events";

/**
 * The only shape a job on `SLA_TIMER_EVENTS_QUEUE` ever takes.
 * `targetAt` is an ISO string here (BullMQ job data is JSON — a `Date`
 * would not survive the round trip); the corresponding `SlaAtRiskEvent`/
 * `SlaBreachedEvent` this processor emits carries a real `Date` instead.
 */
export interface SlaDetectionJobPayload {
  eventType: typeof SLA_AT_RISK_EVENT | typeof SLA_BREACHED_EVENT;
  ticketId: string;
  branchId: string;
  targetType: SlaTargetType;
  targetAt: string;
}

/**
 * The API-side half of Story 15's narrow hand-back bridge — the only
 * `apps/api` BullMQ consumer that exists so far (Story 14 only ever gave
 * `apps/api` producer capability). Translates one typed job into exactly
 * one `EventEmitter2.emit(...)` call. No notification/escalation business
 * behavior — a future story reacts to the emitted events, this class only
 * relays them.
 */
@Injectable()
@Processor(SLA_TIMER_EVENTS_QUEUE)
export class SlaTimerEventsBridgeProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaTimerEventsBridgeProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<SlaDetectionJobPayload>): Promise<void> {
    const payload: SlaAtRiskEvent | SlaBreachedEvent = {
      ticketId: job.data.ticketId,
      branchId: job.data.branchId,
      targetType: job.data.targetType,
      targetAt: new Date(job.data.targetAt),
    };

    if (job.data.eventType === SLA_AT_RISK_EVENT) {
      this.eventEmitter.emit(SLA_AT_RISK_EVENT, payload);
    } else {
      this.eventEmitter.emit(SLA_BREACHED_EVENT, payload);
    }
    this.logger.log(`Emitted ${job.data.eventType} for ticket ${job.data.ticketId}`);
  }
}
