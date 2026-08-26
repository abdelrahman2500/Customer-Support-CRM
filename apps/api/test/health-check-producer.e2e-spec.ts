import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Job, Queue } from "bullmq";
import { AppModule } from "../src/app.module";
import { HealthCheckProducer, HEALTH_CHECK_QUEUE } from "../src/queues/health-check.producer";

/**
 * Integration suite for `HealthCheckProducer` — proves `apps/api` can
 * actually enqueue a job onto the real, Redis-backed `health-check` queue.
 *
 * Unlike every other `*.e2e-spec.ts` in this repository, this suite does
 * not create an HTTP-listening Nest application or use `supertest` —
 * Story 14 deliberately introduces no HTTP endpoint. Instead it resolves
 * `AppModule`'s providers directly from a compiled `TestingModule` (a
 * standard NestJS technique for exercising a provider with no controller
 * in front of it), calling `moduleRef.init()` so lifecycle hooks (i.e.
 * BullMQ's own Redis connection setup) actually run.
 *
 * Does not boot `apps/worker` and does not assert the job is ever
 * processed — per Story 14's Done Criteria, proving a successful enqueue
 * against real Redis is the verification bar; a full producer-to-worker
 * round trip is not required.
 */
describe("HealthCheckProducer (e2e)", () => {
  let moduleRef: TestingModule;
  let producer: HealthCheckProducer;
  let queue: Queue<{ pingedAt: string }>;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    producer = moduleRef.get(HealthCheckProducer);
    queue = moduleRef.get(getQueueToken(HEALTH_CHECK_QUEUE));
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("enqueues a job with a defined id", async () => {
    const job = await producer.ping();
    expect(job.id).toBeDefined();

    await job.remove();
  });

  it("persists the job in the real Redis-backed queue with the enqueued payload", async () => {
    const job: Job<{ pingedAt: string }> = await producer.ping();

    const persisted = await queue.getJob(job.id as string);
    expect(persisted).not.toBeNull();
    expect(persisted?.data.pingedAt).toBe(job.data.pingedAt);

    await job.remove();
  });
});
