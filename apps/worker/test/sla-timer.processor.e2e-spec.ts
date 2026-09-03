import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Job, Queue } from "bullmq";
import { WorkerModule } from "../src/worker.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SlaTimerProcessor } from "../src/queues/sla-timer.processor";
import { SLA_TIMER_EVENTS_QUEUE, type SlaDetectionJobPayload } from "../src/queues/sla-timer-events.types";

/**
 * Integration suite for `SlaTimerProcessor` — real Postgres + real Redis.
 *
 * `apps/worker` has no HTTP surface at all, so fixtures here are created by
 * direct Prisma calls rather than through a real API (the convention
 * `apps/api`'s own e2e suites use) — there is no API client available
 * inside this app. The seeded branch (from `apps/api`'s `prisma:seed`) is
 * reused rather than creating a new `Organization`/`Branch`.
 *
 * The `SlaPolicy` this suite creates is scoped by a freshly-created,
 * uniquely-named `TicketCategory` (Story 120 — never matched by anything
 * else) and is deleted in `afterAll` alongside every other row this suite
 * creates, so nothing leaks into a later run of `apps/api`'s own e2e
 * suites against the same shared, persistent database.
 */
describe("SlaTimerProcessor (e2e)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let processor: SlaTimerProcessor;
  let handbackQueue: Queue<SlaDetectionJobPayload>;
  let branchId: string;
  let customerId: string;
  let slaPolicyId: string;
  let categoryId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    processor = moduleRef.get(SlaTimerProcessor);
    handbackQueue = moduleRef.get(getQueueToken(SLA_TIMER_EVENTS_QUEUE));

    const branch = await prisma.branch.findFirst();
    if (!branch) {
      throw new Error("Expected a seeded branch to exist (run `pnpm --filter @crm/api prisma:seed` first)");
    }
    branchId = branch.id;

    const customer = await prisma.customer.create({
      data: { branchId, displayName: `SLA timer e2e customer ${randomUUID()}` },
    });
    customerId = customer.id;

    const category = await prisma.ticketCategory.create({
      data: { branchId, name: `sla-timer-e2e-${randomUUID()}` },
    });
    categoryId = category.id;

    const policy = await prisma.slaPolicy.create({
      data: {
        branchId,
        categoryId,
        responseTargetMinutes: 100,
        resolutionTargetMinutes: 100_000,
      },
    });
    slaPolicyId = policy.id;
  });

  afterAll(async () => {
    // Deleting the ticket cascades away its SlaTicketTarget; the policy has
    // no more references at that point.
    await prisma.ticket.deleteMany({ where: { customerId } });
    await prisma.slaPolicy.delete({ where: { id: slaPolicyId } });
    await prisma.ticketCategory.delete({ where: { id: categoryId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await moduleRef.close();
  });

  it("detects a breached response target, persists fire-once state, and hands back exactly one job", async () => {
    const ticket = await prisma.ticket.create({
      data: { branchId, customerId, subject: "SLA timer e2e ticket" },
    });
    const pastResponseTargetAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago — already breached
    const farFutureResolutionTargetAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year away
    await prisma.slaTicketTarget.create({
      data: {
        ticketId: ticket.id,
        slaPolicyId,
        responseTargetAt: pastResponseTargetAt,
        resolutionTargetAt: farFutureResolutionTargetAt,
      },
    });

    await processor.process({} as Job);

    const updatedTarget = await prisma.slaTicketTarget.findUnique({ where: { ticketId: ticket.id } });
    expect(updatedTarget?.responseBreachedNotifiedAt).not.toBeNull();
    expect(updatedTarget?.resolutionAtRiskNotifiedAt).toBeNull();

    const waitingJobs = await handbackQueue.getJobs(["waiting", "delayed", "completed"]);
    const matchingJobs = waitingJobs.filter((job) => job.data.ticketId === ticket.id);
    expect(matchingJobs).toHaveLength(1);
    expect(matchingJobs[0]?.data).toEqual({
      eventType: "sla.breached",
      ticketId: ticket.id,
      branchId,
      targetType: "response",
      targetAt: pastResponseTargetAt.toISOString(),
    });

    // A second run must not fire a duplicate — the row is already claimed.
    await processor.process({} as Job);
    const jobsAfterSecondRun = await handbackQueue.getJobs(["waiting", "delayed", "completed"]);
    const matchingJobsAfterSecondRun = jobsAfterSecondRun.filter((job) => job.data.ticketId === ticket.id);
    expect(matchingJobsAfterSecondRun).toHaveLength(1);

    await Promise.all(matchingJobsAfterSecondRun.map((job) => job.remove()));
  });
});
