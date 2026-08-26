import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";
import type { Queue } from "bullmq";
import { AppModule } from "../src/app.module";
import { SLA_TIMERS_QUEUE } from "../src/queues/sla-timers.producer";

/**
 * Integration suite for `SlaTimersProducer` — proves the real `sla-timers`
 * scheduler is registered against real Redis on API boot, and that
 * re-registering it (e.g. on a second app instance, or a restart) is
 * idempotent rather than creating a second scheduler.
 *
 * Follows Story 14's own no-HTTP e2e pattern (`health-check-producer.e2e-spec.ts`):
 * resolves providers directly from a compiled `TestingModule` rather than
 * using `supertest`, since this story introduces no HTTP endpoint either.
 */
describe("SlaTimersProducer (e2e)", () => {
  let moduleRefs: TestingModule[] = [];

  afterEach(async () => {
    await Promise.all(moduleRefs.map((moduleRef) => moduleRef.close()));
    moduleRefs = [];
  });

  async function bootAppModule(): Promise<TestingModule> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    moduleRefs.push(moduleRef);
    return moduleRef;
  }

  it("registers exactly one 60-second scheduler on boot", async () => {
    const moduleRef = await bootAppModule();
    const queue = moduleRef.get<Queue>(getQueueToken(SLA_TIMERS_QUEUE));

    const schedulers = await queue.getJobSchedulers();

    expect(schedulers).toHaveLength(1);
    expect(schedulers[0]?.every).toBe(60_000);
  });

  it("does not create a second scheduler when the module is initialized again", async () => {
    const firstModuleRef = await bootAppModule();
    const firstQueue = firstModuleRef.get<Queue>(getQueueToken(SLA_TIMERS_QUEUE));
    const beforeSchedulers = await firstQueue.getJobSchedulers();
    expect(beforeSchedulers).toHaveLength(1);

    // Simulate a second app instance/restart hitting the same Redis.
    const secondModuleRef = await bootAppModule();
    const secondQueue = secondModuleRef.get<Queue>(getQueueToken(SLA_TIMERS_QUEUE));

    const afterSchedulers = await secondQueue.getJobSchedulers();
    expect(afterSchedulers).toHaveLength(1);
    expect(afterSchedulers[0]?.every).toBe(60_000);
  });
});
