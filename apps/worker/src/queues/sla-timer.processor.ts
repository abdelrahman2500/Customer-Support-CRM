import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { TicketStatus } from "@prisma/client";
import type { Job, Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { evaluateTransition } from "./sla-transition-evaluator";
import {
  SLA_AT_RISK_EVENT,
  SLA_BREACHED_EVENT,
  SLA_TIMER_EVENTS_QUEUE,
  type SlaDetectionJobPayload,
  type SlaTargetType,
} from "./sla-timer-events.types";

/**
 * Must stay identical to `SLA_TIMERS_QUEUE` in
 * apps/api/src/queues/sla-timers.producer.ts.
 */
export const SLA_TIMERS_QUEUE = "sla-timers";

const RELEVANT_TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS"];

/**
 * `apps/worker`'s half of Story 15's SLA timer detection. Never uses
 * `TenantContext` (structurally unavailable outside an HTTP request; see
 * this story's Settled decision 8) — a global, cross-branch sweep is
 * correct here. Never recomputes or modifies `responseTargetAt`/
 * `resolutionTargetAt` — reads them only, as already-resolved absolute
 * instants (Settled decision 3/no business-hours recalculation).
 */
@Injectable()
@Processor(SLA_TIMERS_QUEUE)
export class SlaTimerProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaTimerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SLA_TIMER_EVENTS_QUEUE) private readonly handbackQueue: Queue<SlaDetectionJobPayload>,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const now = new Date();

    const candidates = await this.prisma.slaTicketTarget.findMany({
      where: {
        OR: [{ responseBreachedNotifiedAt: null }, { resolutionBreachedNotifiedAt: null }],
        ticket: { status: { in: RELEVANT_TICKET_STATUSES } },
      },
      select: {
        id: true,
        responseTargetAt: true,
        resolutionTargetAt: true,
        responseAtRiskNotifiedAt: true,
        responseBreachedNotifiedAt: true,
        resolutionAtRiskNotifiedAt: true,
        resolutionBreachedNotifiedAt: true,
        ticket: { select: { id: true, branchId: true } },
        slaPolicy: { select: { responseTargetMinutes: true, resolutionTargetMinutes: true } },
      },
    });

    for (const target of candidates) {
      await this.evaluateAndFire(target, now, "response", target.slaPolicy.responseTargetMinutes);
      await this.evaluateAndFire(target, now, "resolution", target.slaPolicy.resolutionTargetMinutes);
    }
  }

  private async evaluateAndFire(
    target: {
      id: string;
      responseTargetAt: Date;
      resolutionTargetAt: Date;
      responseAtRiskNotifiedAt: Date | null;
      responseBreachedNotifiedAt: Date | null;
      resolutionAtRiskNotifiedAt: Date | null;
      resolutionBreachedNotifiedAt: Date | null;
      ticket: { id: string; branchId: string };
    },
    now: Date,
    targetType: SlaTargetType,
    targetMinutes: number,
  ): Promise<void> {
    const targetAt = targetType === "response" ? target.responseTargetAt : target.resolutionTargetAt;
    const alreadyAtRiskNotified =
      targetType === "response" ? target.responseAtRiskNotifiedAt !== null : target.resolutionAtRiskNotifiedAt !== null;
    const alreadyBreachedNotified =
      targetType === "response" ? target.responseBreachedNotifiedAt !== null : target.resolutionBreachedNotifiedAt !== null;

    const transition = evaluateTransition({ now, targetAt, targetMinutes, alreadyAtRiskNotified, alreadyBreachedNotified });
    if (transition === "none") {
      return;
    }

    const claimed =
      transition === "breach"
        ? await this.claim(target.id, targetType, "breach", now)
        : await this.claim(target.id, targetType, "at_risk", now);
    if (!claimed) {
      // Another concurrent/overlapping run already claimed this exact
      // transition — do not enqueue a duplicate hand-back job.
      return;
    }

    const payload: SlaDetectionJobPayload = {
      eventType: transition === "breach" ? SLA_BREACHED_EVENT : SLA_AT_RISK_EVENT,
      ticketId: target.ticket.id,
      branchId: target.ticket.branchId,
      targetType,
      targetAt: targetAt.toISOString(),
    };
    await this.handbackQueue.add("sla-detection", payload);
    this.logger.log(`Fired ${payload.eventType} (${targetType}) for ticket ${target.ticket.id}`);
  }

  /**
   * Atomically claims the right to fire one transition for one target via
   * a conditional `updateMany` (`where` includes the "not yet notified"
   * column) — the same instant Postgres commits the update, `count`
   * reports whether *this* call actually changed the row. If a concurrent
   * or overlapping timer run already claimed it first, `count` is 0 and
   * this call must not enqueue a hand-back job. This is what
   * "safe across multiple worker instances" (this story's own requirement)
   * means concretely: BullMQ's own per-job lock only prevents two workers
   * processing the *same* scheduled tick simultaneously, not two
   * *different* overlapping ticks (if one run takes longer than the
   * 60-second interval) from evaluating the same row — this conditional
   * update is what closes that second, real race window.
   *
   * The update is attempted before the hand-back job is enqueued, not
   * after: if the enqueue itself then fails, the transition is marked
   * fired but no job exists — an accepted, documented rare-failure gap
   * (favoring "never duplicate" over "never lose," per this story's own
   * priority) rather than an attempted exactly-once guarantee across two
   * separate systems (Postgres and Redis), which nothing in this story's
   * scope justifies building.
   */
  private async claim(
    targetId: string,
    targetType: SlaTargetType,
    transition: "at_risk" | "breach",
    now: Date,
  ): Promise<boolean> {
    if (targetType === "response" && transition === "at_risk") {
      const result = await this.prisma.slaTicketTarget.updateMany({
        where: { id: targetId, responseAtRiskNotifiedAt: null },
        data: { responseAtRiskNotifiedAt: now },
      });
      return result.count === 1;
    }
    if (targetType === "response" && transition === "breach") {
      const result = await this.prisma.slaTicketTarget.updateMany({
        where: { id: targetId, responseBreachedNotifiedAt: null },
        data: { responseBreachedNotifiedAt: now },
      });
      return result.count === 1;
    }
    if (targetType === "resolution" && transition === "at_risk") {
      const result = await this.prisma.slaTicketTarget.updateMany({
        where: { id: targetId, resolutionAtRiskNotifiedAt: null },
        data: { resolutionAtRiskNotifiedAt: now },
      });
      return result.count === 1;
    }
    const result = await this.prisma.slaTicketTarget.updateMany({
      where: { id: targetId, resolutionBreachedNotifiedAt: null },
      data: { resolutionBreachedNotifiedAt: now },
    });
    return result.count === 1;
  }
}
