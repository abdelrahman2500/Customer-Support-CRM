import { describe, expect, it, vi } from "vitest";
import { WebhookDispatchProducer } from "./webhook-dispatch.producer";
import type { WebhookDispatchJobPayload } from "./webhook-dispatch.producer";
import type { Job, Queue } from "bullmq";

function buildQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProducer(queueMock: ReturnType<typeof buildQueueMock>): WebhookDispatchProducer {
  return new WebhookDispatchProducer(queueMock as unknown as Queue<WebhookDispatchJobPayload>);
}

const PAYLOAD: WebhookDispatchJobPayload = {
  subscriptionId: "subscription-1",
  eventType: "ticket.updated",
  ticketId: "ticket-1",
};

describe("WebhookDispatchProducer", () => {
  describe("enqueue", () => {
    it("enqueues a dispatch job with the given payload unchanged, with retry/backoff configured", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-1" } as Job<WebhookDispatchJobPayload>;
      queue.add.mockResolvedValue(fakeJob);
      const producer = createProducer(queue);

      await producer.enqueue(PAYLOAD);

      expect(queue.add).toHaveBeenCalledOnce();
      expect(queue.add).toHaveBeenCalledWith("dispatch", PAYLOAD, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });
    });

    it("resolves with whatever the queue's add() resolved to", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-2" } as Job<WebhookDispatchJobPayload>;
      queue.add.mockResolvedValue(fakeJob);
      const producer = createProducer(queue);

      const result = await producer.enqueue(PAYLOAD);

      expect(result).toBe(fakeJob);
    });

    it("propagates a rejection from the queue instead of catching it", async () => {
      const queue = buildQueueMock();
      queue.add.mockRejectedValue(new Error("redis unavailable"));
      const producer = createProducer(queue);

      await expect(producer.enqueue(PAYLOAD)).rejects.toThrow("redis unavailable");
    });
  });
});
