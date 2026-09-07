import { describe, expect, it, vi } from "vitest";
import { ChannelMessageDeliveryProducer } from "./channel-message-delivery.producer";
import type { ChannelMessageDeliveryJobPayload } from "./channel-message-delivery.producer";
import type { Job, Queue } from "bullmq";

function buildQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProducer(
  queueMock: ReturnType<typeof buildQueueMock>,
): ChannelMessageDeliveryProducer {
  return new ChannelMessageDeliveryProducer(
    queueMock as unknown as Queue<ChannelMessageDeliveryJobPayload>,
  );
}

const PAYLOAD: ChannelMessageDeliveryJobPayload = {
  channelMessageId: "message-1",
  ticketId: "ticket-1",
  channelType: "EMAIL",
  body: "Your invoice is attached.",
};

describe("ChannelMessageDeliveryProducer", () => {
  describe("enqueue", () => {
    it("enqueues a deliver job with the given payload unchanged, with retry/backoff configured", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-1" } as Job<ChannelMessageDeliveryJobPayload>;
      queue.add.mockResolvedValue(fakeJob);
      const producer = createProducer(queue);

      await producer.enqueue(PAYLOAD);

      expect(queue.add).toHaveBeenCalledOnce();
      expect(queue.add).toHaveBeenCalledWith("deliver", PAYLOAD, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });
    });

    it("resolves with whatever the queue's add() resolved to", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-2" } as Job<ChannelMessageDeliveryJobPayload>;
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
