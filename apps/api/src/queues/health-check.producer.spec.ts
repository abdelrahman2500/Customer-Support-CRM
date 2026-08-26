import { describe, expect, it, vi } from "vitest";
import { HealthCheckProducer } from "./health-check.producer";
import type { Job, Queue } from "bullmq";

function buildQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProducer(queueMock: ReturnType<typeof buildQueueMock>): HealthCheckProducer {
  return new HealthCheckProducer(queueMock as unknown as Queue<{ pingedAt: string }>);
}

describe("HealthCheckProducer", () => {
  describe("ping", () => {
    it("enqueues a ping job with an ISO-string pingedAt payload", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-1" } as Job<{ pingedAt: string }>;
      queue.add.mockResolvedValue(fakeJob);
      const producer = createProducer(queue);

      await producer.ping();

      expect(queue.add).toHaveBeenCalledOnce();
      expect(queue.add).toHaveBeenCalledWith("ping", { pingedAt: expect.any(String) });
      const [, data] = queue.add.mock.calls[0] as [string, { pingedAt: string }];
      expect(() => new Date(data.pingedAt).toISOString()).not.toThrow();
    });

    it("resolves with whatever the queue's add() resolved to", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-2" } as Job<{ pingedAt: string }>;
      queue.add.mockResolvedValue(fakeJob);
      const producer = createProducer(queue);

      const result = await producer.ping();

      expect(result).toBe(fakeJob);
    });

    it("propagates a rejection from the queue instead of catching it", async () => {
      const queue = buildQueueMock();
      queue.add.mockRejectedValue(new Error("redis unavailable"));
      const producer = createProducer(queue);

      await expect(producer.ping()).rejects.toThrow("redis unavailable");
    });
  });
});
