import { describe, expect, it, vi } from "vitest";
import { SlaTimersProducer } from "./sla-timers.producer";
import type { Queue } from "bullmq";

function buildQueueMock() {
  return {
    upsertJobScheduler: vi.fn(),
  };
}

describe("SlaTimersProducer", () => {
  describe("onModuleInit", () => {
    it("registers a 60-second job scheduler with a stable id", async () => {
      const queue = buildQueueMock();
      const producer = new SlaTimersProducer(queue as unknown as Queue);

      await producer.onModuleInit();

      expect(queue.upsertJobScheduler).toHaveBeenCalledOnce();
      expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
        "sla-timers-scheduler",
        { every: 60_000 },
        { name: "check" },
      );
    });

    it("is idempotent — calling onModuleInit twice does not change the scheduler id/options", async () => {
      const queue = buildQueueMock();
      const producer = new SlaTimersProducer(queue as unknown as Queue);

      await producer.onModuleInit();
      await producer.onModuleInit();

      expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
      const [firstCall, secondCall] = queue.upsertJobScheduler.mock.calls;
      expect(firstCall).toEqual(secondCall);
    });
  });
});
