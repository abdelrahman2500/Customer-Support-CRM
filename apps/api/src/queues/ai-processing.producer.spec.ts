import { describe, expect, it, vi } from "vitest";
import { AiProcessingProducer } from "./ai-processing.producer";
import type { AiProcessingJobPayload } from "./ai-processing.producer";
import type { Job, Queue } from "bullmq";

function buildQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProducer(queueMock: ReturnType<typeof buildQueueMock>): AiProcessingProducer {
  return new AiProcessingProducer(queueMock as unknown as Queue<AiProcessingJobPayload>);
}

const PAYLOAD: AiProcessingJobPayload = {
  aiPromptLogId: "log-1",
  ticketId: "ticket-1",
  branchId: "branch-1",
  feature: "SUMMARIZE",
  subject: "Login issue",
  body: "Checked logs.",
};

describe("AiProcessingProducer", () => {
  describe("enqueue", () => {
    it("enqueues a process job with the given payload unchanged", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-1" } as Job<AiProcessingJobPayload>;
      queue.add.mockResolvedValue(fakeJob);
      const producer = createProducer(queue);

      await producer.enqueue(PAYLOAD);

      expect(queue.add).toHaveBeenCalledOnce();
      expect(queue.add).toHaveBeenCalledWith("process", PAYLOAD);
    });

    it("resolves with whatever the queue's add() resolved to", async () => {
      const queue = buildQueueMock();
      const fakeJob = { id: "job-2" } as Job<AiProcessingJobPayload>;
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
