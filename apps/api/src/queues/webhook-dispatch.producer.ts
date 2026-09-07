import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import type { WebhookEventType } from "../modules/integrations/webhook-event-types";

/**
 * Must stay identical to `WEBHOOK_DISPATCH_QUEUE` in
 * apps/worker/src/queues/webhook-dispatch.processor.ts — no cross-app
 * shared-constants mechanism exists in this repository (Story 14's own
 * precedent for `HEALTH_CHECK_QUEUE`), so this is a deliberately duplicated
 * literal, not an import.
 */
export const WEBHOOK_DISPATCH_QUEUE = "webhook-dispatch";

/** Deliberately minimal — `subscriptionId` is the only thing the worker
 * needs to re-fetch the subscription's current `targetUrl`/`secret`/
 * `isActive` at process time (mirrors `ChannelMessageDeliveryJobPayload`'s
 * own "re-fetch fresh state, don't denormalize into the job" convention),
 * rather than risk dispatching against a target/secret that has since
 * changed or a subscription since deactivated. */
export interface WebhookDispatchJobPayload {
  subscriptionId: string;
  eventType: WebhookEventType;
  ticketId: string;
}

/**
 * RM-20 — the API-side producer for `webhook-dispatch`. `attempts`/
 * `backoff` mirror `ChannelMessageDeliveryProducer`'s own values exactly:
 * an outbound HTTP POST to a caller-supplied URL is exactly the kind of
 * flaky external transport that policy was written for (a target that is
 * briefly down, a transient DNS/TLS hiccup).
 */
@Injectable()
export class WebhookDispatchProducer {
  constructor(
    @InjectQueue(WEBHOOK_DISPATCH_QUEUE)
    private readonly queue: Queue<WebhookDispatchJobPayload>,
  ) {}

  async enqueue(payload: WebhookDispatchJobPayload): Promise<Job<WebhookDispatchJobPayload>> {
    return this.queue.add("dispatch", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
  }
}
