import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Job, Queue } from "bullmq";
import { AppModule } from "../src/app.module";
import {
  ChannelMessageDeliveryProducer,
  CHANNEL_MESSAGE_DELIVERY_QUEUE,
} from "../src/queues/channel-message-delivery.producer";
import type { ChannelMessageDeliveryJobPayload } from "../src/queues/channel-message-delivery.producer";

/**
 * RM-13 — integration suite for `ChannelMessageDeliveryProducer`,
 * mirroring `ai-processing-producer.e2e-spec.ts`'s exact shape and scope
 * boundary (Story 14/76's own precedent): proves `apps/api` can actually
 * enqueue a job onto the real, Redis-backed `channel-message-delivery`
 * queue, with the retry/backoff options this queue is this repository's
 * first to configure. Does not boot `apps/worker` and does not assert
 * the job is ever processed — a full producer-to-worker round trip is
 * out of this story's verification bar, exactly as it was for Story
 * 14/76's own equivalent suites.
 */
describe("ChannelMessageDeliveryProducer (e2e)", () => {
  let moduleRef: TestingModule;
  let producer: ChannelMessageDeliveryProducer;
  let queue: Queue<ChannelMessageDeliveryJobPayload>;

  const payload: ChannelMessageDeliveryJobPayload = {
    channelMessageId: "00000000-0000-4000-8000-000000000000",
    ticketId: "00000000-0000-4000-8000-000000000001",
    channelType: "EMAIL",
    body: "Your invoice is attached.",
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    producer = moduleRef.get(ChannelMessageDeliveryProducer);
    queue = moduleRef.get(getQueueToken(CHANNEL_MESSAGE_DELIVERY_QUEUE));
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("enqueues a job with a defined id", async () => {
    const job = await producer.enqueue(payload);
    expect(job.id).toBeDefined();

    await job.remove();
  });

  it("persists the job in the real Redis-backed queue with the enqueued payload and retry/backoff options", async () => {
    const job: Job<ChannelMessageDeliveryJobPayload> = await producer.enqueue(payload);

    const persisted = await queue.getJob(job.id as string);
    expect(persisted).not.toBeNull();
    expect(persisted?.data).toEqual(payload);
    expect(persisted?.opts.attempts).toBe(3);
    expect(persisted?.opts.backoff).toEqual({ type: "exponential", delay: 5000 });

    await job.remove();
  });
});
