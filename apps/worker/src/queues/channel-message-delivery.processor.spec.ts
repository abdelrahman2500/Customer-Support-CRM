import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelMessageDeliveryJobPayload } from "./channel-message-delivery.processor";
import type { PrismaService } from "../prisma/prisma.service";
import type { ChannelAdapterRegistry } from "../channels/channel-adapter-registry";
import type { Job, Queue } from "bullmq";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

// Imported after the mock so the mocked module is what the processor sees.
import * as Sentry from "@sentry/node";
import { ChannelMessageDeliveryProcessor, CHANNEL_MESSAGE_DELIVERY_QUEUE } from "./channel-message-delivery.processor";

function buildPrismaMock() {
  return {
    channelMessage: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  };
}

function buildAdapterRegistryMock() {
  return {
    resolve: vi.fn(),
  };
}

function buildHandbackQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProcessor(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  adapterRegistryMock: ReturnType<typeof buildAdapterRegistryMock>,
  handbackMock: ReturnType<typeof buildHandbackQueueMock>,
): ChannelMessageDeliveryProcessor {
  return new ChannelMessageDeliveryProcessor(
    prismaMock as unknown as PrismaService,
    adapterRegistryMock as unknown as ChannelAdapterRegistry,
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
  channelType: "LIVE_CHAT",
  body: "How can I help?",
};

const ROW = {
  id: "message-1",
  ticketId: "ticket-1",
  channelType: "LIVE_CHAT" as const,
  direction: "OUTBOUND" as const,
  senderContactId: null,
  senderUserId: "user-1",
  body: "How can I help?",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  deliveryStatus: "PENDING" as const,
  externalMessageId: null,
  failureReason: null,
  retryCount: 0,
};

const UPDATED_ROW = {
  ...ROW,
  deliveryStatus: "SENT" as const,
  externalMessageId: "provider-msg-1",
};

describe("ChannelMessageDeliveryProcessor", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let adapterRegistry: ReturnType<typeof buildAdapterRegistryMock>;
  let handbackQueue: ReturnType<typeof buildHandbackQueueMock>;
  let processor: ChannelMessageDeliveryProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    adapterRegistry = buildAdapterRegistryMock();
    handbackQueue = buildHandbackQueueMock();
    processor = createProcessor(prisma, adapterRegistry, handbackQueue);
  });

  describe("process", () => {
    it("resolves the adapter for the job's channelType, sends the fetched row through it, marks the row SENT, and hands back delivery-sent", async () => {
      const adapter = { send: vi.fn().mockResolvedValue({ externalMessageId: "provider-msg-1" }) };
      adapterRegistry.resolve.mockReturnValue(adapter);
      prisma.channelMessage.findUniqueOrThrow.mockResolvedValue(ROW);
      prisma.channelMessage.update.mockResolvedValue(UPDATED_ROW);
      const job = buildJob(PAYLOAD);

      await processor.process(job);

      expect(adapterRegistry.resolve).toHaveBeenCalledWith("LIVE_CHAT");
      expect(prisma.channelMessage.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "message-1" } });
      expect(adapter.send).toHaveBeenCalledWith(ROW);
      expect(prisma.channelMessage.update).toHaveBeenCalledWith({
        where: { id: "message-1" },
        data: { deliveryStatus: "SENT", externalMessageId: "provider-msg-1" },
      });
      expect(handbackQueue.add).toHaveBeenCalledWith("delivery-sent", {
        ticketId: "ticket-1",
        message: { ...UPDATED_ROW, createdAt: "2024-01-01T00:00:00.000Z" },
      });
    });

    // RM-14 — Channel Adapter Interface + Registry.
    it("leaves the message PENDING and logs a warning, without touching Prisma or handing back, when no adapter is registered for the channel", async () => {
      adapterRegistry.resolve.mockReturnValue(undefined);
      const job = buildJob({ ...PAYLOAD, channelType: "EMAIL" });

      await processor.process(job);

      expect(adapterRegistry.resolve).toHaveBeenCalledWith("EMAIL");
      expect(prisma.channelMessage.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(prisma.channelMessage.update).not.toHaveBeenCalled();
      expect(handbackQueue.add).not.toHaveBeenCalled();
    });

    it("propagates a rejection from the adapter instead of catching it (BullMQ's own retry then applies)", async () => {
      const adapter = { send: vi.fn().mockRejectedValue(new Error("transient failure")) };
      adapterRegistry.resolve.mockReturnValue(adapter);
      prisma.channelMessage.findUniqueOrThrow.mockResolvedValue(ROW);
      const job = buildJob(PAYLOAD);

      await expect(processor.process(job)).rejects.toThrow("transient failure");
      expect(prisma.channelMessage.update).not.toHaveBeenCalled();
      expect(handbackQueue.add).not.toHaveBeenCalled();
    });

    // RM-15 — the minimal idempotency guard.
    it.each(["SENT", "DELIVERED"] as const)(
      "skips the send and logs a warning, without touching Prisma or handing back, when the fetched row is already %s",
      async (deliveryStatus) => {
        const adapter = { send: vi.fn() };
        adapterRegistry.resolve.mockReturnValue(adapter);
        prisma.channelMessage.findUniqueOrThrow.mockResolvedValue({ ...ROW, deliveryStatus });
        const job = buildJob(PAYLOAD);

        await processor.process(job);

        expect(adapter.send).not.toHaveBeenCalled();
        expect(prisma.channelMessage.update).not.toHaveBeenCalled();
        expect(handbackQueue.add).not.toHaveBeenCalled();
      },
    );

    it("still sends when the fetched row is PENDING or FAILED (a genuine retry, not a duplicate)", async () => {
      const adapter = { send: vi.fn().mockResolvedValue({ externalMessageId: "provider-msg-1" }) };
      adapterRegistry.resolve.mockReturnValue(adapter);
      prisma.channelMessage.findUniqueOrThrow.mockResolvedValue({ ...ROW, deliveryStatus: "FAILED" });
      prisma.channelMessage.update.mockResolvedValue(UPDATED_ROW);
      const job = buildJob(PAYLOAD);

      await processor.process(job);

      expect(adapter.send).toHaveBeenCalledOnce();
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
        ...ROW,
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
        ...ROW,
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
