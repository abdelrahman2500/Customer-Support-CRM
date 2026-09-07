import { createHmac } from "node:crypto";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import * as Sentry from "@sentry/node";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Must stay identical to `WEBHOOK_DISPATCH_QUEUE` in
 * apps/api/src/queues/webhook-dispatch.producer.ts.
 */
export const WEBHOOK_DISPATCH_QUEUE = "webhook-dispatch";

/** Must stay identical to `WebhookDispatchJobPayload` in
 * apps/api/src/queues/webhook-dispatch.producer.ts. */
export interface WebhookDispatchJobPayload {
  subscriptionId: string;
  eventType: string;
  ticketId: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * RM-20 — `apps/worker`'s half of webhook dispatch. Re-fetches the
 * subscription fresh at process time (never trusts a denormalized
 * `targetUrl`/`secret` from the job payload — see the producer's own doc
 * comment); a subscription deactivated or deleted between enqueue and now
 * is honored, not the state it had when the job was created.
 *
 * Signs the outbound body with HMAC-SHA256 over the exact JSON string sent
 * (`X-Webhook-Signature: sha256=<hex>`, the same `algo=hex` shape GitHub's
 * own webhook signing header uses) — a well-known convention, not a
 * bespoke one, so a receiving integration can verify it with any standard
 * HMAC library.
 *
 * Exactly one `WebhookDeliveryAttempt` row is written per invocation,
 * whether this attempt is the first or a BullMQ retry — the acceptance
 * criterion "every attempt, successful or not, is visible in a
 * delivery-attempt log" is this table's own natural per-invocation history,
 * not a separately-maintained summary (mirrors
 * `ChannelMessageDeliveryProcessor`'s own "durably updates via this app's
 * own `PrismaService`" convention for writing outcomes directly, not via a
 * hand-back to `apps/api`). A failed attempt is recorded, then rethrown, so
 * BullMQ's own `attempts`/`backoff` (set by the producer) drives the
 * retry — this processor adds no second retry mechanism of its own.
 */
@Injectable()
@Processor(WEBHOOK_DISPATCH_QUEUE)
export class WebhookDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDispatchProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<WebhookDispatchJobPayload>): Promise<void> {
    const subscription = await this.prisma.webhookSubscription.findUnique({
      where: { id: job.data.subscriptionId },
    });
    if (!subscription || !subscription.isActive) {
      this.logger.warn(
        `Webhook subscription ${job.data.subscriptionId} is no longer active — skipping dispatch`,
      );
      return;
    }

    const body = JSON.stringify({
      eventType: job.data.eventType,
      ticketId: job.data.ticketId,
      occurredAt: new Date().toISOString(),
    });
    const signature = createHmac("sha256", subscription.secret).update(body).digest("hex");

    let responseStatus: number | null = null;
    let succeeded = false;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(subscription.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      responseStatus = response.status;
      succeeded = response.ok;
      if (!succeeded) {
        errorMessage = `Target responded with ${response.status}`;
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    await this.prisma.webhookDeliveryAttempt.create({
      data: {
        subscriptionId: subscription.id,
        eventType: job.data.eventType,
        succeeded,
        responseStatus,
        errorMessage,
      },
    });

    if (succeeded) {
      this.logger.log(
        `Dispatched ${job.data.eventType} to webhook subscription ${subscription.id} (${responseStatus})`,
      );
      return;
    }

    this.logger.warn(`Webhook dispatch to subscription ${subscription.id} failed: ${errorMessage}`);
    throw new Error(errorMessage ?? "Webhook dispatch failed");
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<WebhookDispatchJobPayload> | undefined, error: Error): void {
    Sentry.captureException(error, {
      tags: { queue: WEBHOOK_DISPATCH_QUEUE, jobId: job?.id },
    });
  }
}
