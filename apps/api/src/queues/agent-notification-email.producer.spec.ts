import { describe, expect, it, vi } from "vitest";
import { AgentNotificationEmailProducer } from "./agent-notification-email.producer";
import type { AgentNotificationEmailJobPayload } from "./agent-notification-email.producer";
import type { Job, Queue } from "bullmq";

function buildQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProducer(
  queueMock: ReturnType<typeof buildQueueMock>,
): AgentNotificationEmailProducer {
  return new AgentNotificationEmailProducer(
    queueMock as unknown as Queue<AgentNotificationEmailJobPayload>,
  );
}

const PAYLOAD: AgentNotificationEmailJobPayload = {
  ticketId: "ticket-1",
  eventType: "ticket.escalated",
  recipientUserId: "user-1",
};

describe("AgentNotificationEmailProducer", () => {
  describe("enqueue", () => {
    it("enqueues a send job with the given payload unchanged, with no retry override", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-1" } as Job<AgentNotificationEmailJobPayload>;
      queue.add.mockResolvedValue(fakeJob);
      const producer = createProducer(queue);

      await producer.enqueue(PAYLOAD);

      expect(queue.add).toHaveBeenCalledOnce();
      expect(queue.add).toHaveBeenCalledWith("send", PAYLOAD);
    });

    it("resolves with whatever the queue's add() resolved to", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-2" } as Job<AgentNotificationEmailJobPayload>;
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
