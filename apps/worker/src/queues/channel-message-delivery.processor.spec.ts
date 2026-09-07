import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelMessageDeliveryJobPayload } from "./channel-message-delivery.processor";
import type { PrismaService } from "../prisma/prisma.service";
import type { Job, Queue } from "bullmq";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));
vi.mock("./no-op-channel-adapter", () => ({ sendViaNoOpAdapter: vi.fn() }));

// Imported after the mocks so the mocked modules are what the processor sees.
import * as Sentry from "@sentry/node";
import { sendViaNoOpAdapter } from "./no-op-channel-adapter";
import { ChannelMessageDeliveryProcessor, CHANNEL_MESSAGE_DELIVERY_QUEUE } from "./channel-message-delivery.processor";

function buildPrismaMock() {
  return {
    channelMessage: {
      update: vi.fn(),
    },
  };
}

function buildHandbackQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProcessor(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  handbackMock: ReturnType<typeof buildHandbackQueueMock>,
): ChannelMessageDeliveryProcessor {
  return new ChannelMessageDeliveryProcessor(
    prismaMock as unknown as PrismaService,
    handbackMock as unknown as Queue,
  );
}

function buildJob(
  data: ChannelMessageDeliveryJobPayload,
  overrides: Partial<Job<ChannelMessageDeliveryJobPayload>> = {},
): Job<ChannelMessageDeliveryJobPayload> {
  return { data, attemptsMade: 1, opts: { attempts: 3 }, ...overrides } as Job<ChannelMessageDeliveryJobPayload>;
}

const PAYLOAD: ChannelMessageDeliveryJobPayload = {
  channelMessageId: "message-1",
  ticketId: "ticket-1",
  channelType: "EMAIL",
  body: "Your invoice is attached.",
};

const UPDATED_ROW = {
  id: "message-1",
  ticketId: "ticket-1",
  channelType: "EMAIL" as const,
  direction: "OUTBOUND" as const,
  senderContactId: null,
  senderUserId: "user-1",
  body: "Your invoice is attached.",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  deliveryStatus: "SENT" as const,
  externalMessageId: "noop-abc",
  failureReason: null,
  retryCount: 0,
};

describe("ChannelMessageDeliveryProcessor", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let handbackQueue: ReturnType<typeof buildHandbackQueueMock>;
  let processor: ChannelMessageDeliveryProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    handbackQueue = buildHandbackQueueMock();
    processor = createProcessor(prisma, handbackQueue);
  });

  describe("process", () => {
    it("sends via the no-op adapter, marks the row SENT with the adapter's externalMessageId, and hands back delivery-sent", async () => {
      vi.mocked(sendViaNoOpAdapter).mockResolvedValue({ externalMessageId: "noop-abc" });
      prisma.channelMessage.update.mockResolvedValue(UPDATED_ROW);
      const job = buildJob(PAYLOAD);

      await processor.process(job);

      expect(sendViaNoOpAdapter).toHaveBeenCalledWith({
        channelMessageId: "message-1",
        body: "Your invoice is attached.",
      });
      expect(prisma.channelMessage.update).toHaveBeenCalledWith({
        where: { id: "message-1" },
        data: { deliveryStatus: "SENT", externalMessageId: "noop-abc" },
      });
      expect(handbackQueue.add).toHaveBeenCalledWith("delivery-sent", {
        ticketId: "ticket-1",
        message: { ...UPDATED_ROW, createdAt: "2024-01-01T00:00:00.000Z" },
      });
    });

    it("propagates a rejection from the adapter instead of catching it (BullMQ's own retry then applies)", async () => {
      vi.mocked(sendViaNoOpAdapter).mockRejectedValue(new Error("transient failure"));
      const job = buildJob(PAYLOAD);

      await expect(processor.process(job)).rejects.toThrow("transient failure");
      expect(prisma.channelMessage.update).not.toHaveBeenCalled();
      expect(handbackQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("onFailed", () => {
    it("always reports the error to Sentry, tagged with the queue and job id", async () => {
      const error = new Error("transient failure");
      const job = buildJob(PAYLOAD, { id: "job-1", attemptsMade: 1, opts: { attempts: 3 } });

      await processor.onFailed(job, error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { queue: CHANNEL_MESSAGE_DELIVERY_QUEUE, jobId: "job-1" },
      });
    });

    it("tolerates an undefined job (BullMQ's own documented stalled-job case)", async () => {
      const error = new Error("stalled");

      await processor.onFailed(undefined, error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { queue: CHANNEL_MESSAGE_DELIVERY_QUEUE, jobId: undefined },
      });
    });

    it("does not mark the row FAILED or hand back while attempts remain", async () => {
      const error = new Error("transient failure");
      const job = buildJob(PAYLOAD, { attemptsMade: 1, opts: { attempts: 3 } });

      await processor.onFailed(job, error);

      expect(prisma.channelMessage.update).not.toHaveBeenCalled();
      expect(handbackQueue.add).not.toHaveBeenCalled();
    });

    it("marks the row FAILED with the error message and exact attempt count once every attempt is exhausted, and hands back delivery-failed", async () => {
      const error = new Error("Provider rejected: invalid recipient");
      const job = buildJob(PAYLOAD, { attemptsMade: 3, opts: { attempts: 3 } });
      const failedRow = {
        ...UPDATED_ROW,
        deliveryStatus: "FAILED" as const,
        externalMessageId: null,
        failureReason: "Provider rejected: invalid recipient",
        retryCount: 3,
      };
      prisma.channelMessage.update.mockResolvedValue(failedRow);

      await processor.onFailed(job, error);

      expect(prisma.channelMessage.update).toHaveBeenCalledWith({
        where: { id: "message-1" },
        data: { deliveryStatus: "FAILED", failureReason: "Provider rejected: invalid recipient", retryCount: 3 },
      });
      expect(handbackQueue.add).toHaveBeenCalledWith("delivery-failed", {
        ticketId: "ticket-1",
        message: { ...failedRow, createdAt: "2024-01-01T00:00:00.000Z" },
      });
    });

    it("treats a job with no attempts configured as a single-attempt job (defaults to 1)", async () => {
      const error = new Error("transient failure");
      const job = buildJob(PAYLOAD, { attemptsMade: 1, opts: {} });
      prisma.channelMessage.update.mockResolvedValue({
        ...UPDATED_ROW,
        deliveryStatus: "FAILED" as const,
        externalMessageId: null,
        failureReason: "transient failure",
        retryCount: 1,
      });

      await processor.onFailed(job, error);

      expect(prisma.channelMessage.update).toHaveBeenCalledWith({
        where: { id: "message-1" },
        data: { deliveryStatus: "FAILED", failureReason: "transient failure", retryCount: 1 },
      });
    });
  });
});
