import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Job, Queue } from "bullmq";
import { AppModule } from "../src/app.module";
import { AiProcessingProducer, AI_PROCESSING_QUEUE } from "../src/queues/ai-processing.producer";
import type { AiProcessingJobPayload } from "../src/queues/ai-processing.producer";

/**
 * Story 76 — integration suite for `AiProcessingProducer`, mirroring
 * `health-check-producer.e2e-spec.ts`'s exact shape and scope boundary
 * (Story 14's own precedent): proves `apps/api` can actually enqueue a
 * job onto the real, Redis-backed `ai-processing` queue. Does not boot
 * `apps/worker` and does not assert the job is ever processed — a full
 * producer-to-worker round trip is out of this story's verification bar,
 * exactly as it was for Story 14/15's own equivalent suites.
 *
 * `tickets.e2e-spec.ts`'s own "enqueues a real ai-processing job" test
 * covers the same queue through the real HTTP endpoint; this suite
 * exercises the producer directly, with a fixed payload, for a more
 * focused proof.
 */
describe("AiProcessingProducer (e2e)", () => {
  let moduleRef: TestingModule;
  let producer: AiProcessingProducer;
  let queue: Queue<AiProcessingJobPayload>;

  const payload: AiProcessingJobPayload = {
    aiPromptLogId: "00000000-0000-4000-8000-000000000000",
    ticketId: "00000000-0000-4000-8000-000000000001",
    branchId: "00000000-0000-4000-8000-000000000002",
    feature: "SUMMARIZE",
    subject: "Test subject",
    body: "Test body",
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    producer = moduleRef.get(AiProcessingProducer);
    queue = moduleRef.get(getQueueToken(AI_PROCESSING_QUEUE));
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("enqueues a job with a defined id", async () => {
    const job = await producer.enqueue(payload);
    expect(job.id).toBeDefined();

    await job.remove();
  });

  it("persists the job in the real Redis-backed queue with the enqueued payload", async () => {
    const job: Job<AiProcessingJobPayload> = await producer.enqueue(payload);

    const persisted = await queue.getJob(job.id as string);
    expect(persisted).not.toBeNull();
    expect(persisted?.data).toEqual(payload);

    await job.remove();
  });
});
