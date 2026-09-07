import { describe, expect, it, vi } from "vitest";
import { ChannelMessageDeliveryEventsBridgeProcessor } from "./channel-message-delivery-events-bridge.processor";
import type { ChannelMessageDeliveryOutcomeJobPayload } from "./channel-message-delivery-events-bridge.processor";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../modules/channels/channel-messages.events";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";

function buildEventEmitterMock() {
  return {
    emit: vi.fn(),
  };
}

function createProcessor(
  emitterMock: ReturnType<typeof buildEventEmitterMock>,
): ChannelMessageDeliveryEventsBridgeProcessor {
  return new ChannelMessageDeliveryEventsBridgeProcessor(emitterMock as unknown as EventEmitter2);
}

function buildJob(
  data: ChannelMessageDeliveryOutcomeJobPayload,
): Job<ChannelMessageDeliveryOutcomeJobPayload> {
  return { data } as Job<ChannelMessageDeliveryOutcomeJobPayload>;
}

const SENT_PAYLOAD: ChannelMessageDeliveryOutcomeJobPayload = {
  ticketId: "ticket-1",
  message: {
    id: "message-1",
    ticketId: "ticket-1",
    channelType: "EMAIL",
    direction: "OUTBOUND",
    senderContactId: null,
    senderUserId: "user-1",
    body: "Your invoice is attached.",
    createdAt: "2024-01-01T00:00:00.000Z",
    deliveryStatus: "SENT",
    externalMessageId: "noop-abc",
    failureReason: null,
    retryCount: 0,
  },
};

describe("ChannelMessageDeliveryEventsBridgeProcessor", () => {
  describe("process", () => {
    it("emits channel.message.created with the job's message, converting createdAt back to a Date", async () => {
      const emitter = buildEventEmitterMock();
      const processor = createProcessor(emitter);
      const job = buildJob(SENT_PAYLOAD);

      await processor.process(job);

      expect(emitter.emit).toHaveBeenCalledOnce();
      expect(emitter.emit).toHaveBeenCalledWith(CHANNEL_MESSAGE_CREATED_EVENT, {
        ticketId: "ticket-1",
        message: { ...SENT_PAYLOAD.message, createdAt: new Date("2024-01-01T00:00:00.000Z") },
      });
    });

    it("emits the same event for a FAILED outcome exactly like a SENT one", async () => {
      const emitter = buildEventEmitterMock();
      const processor = createProcessor(emitter);
      const failedPayload: ChannelMessageDeliveryOutcomeJobPayload = {
        ticketId: "ticket-2",
        message: {
          ...SENT_PAYLOAD.message,
          id: "message-2",
          ticketId: "ticket-2",
          deliveryStatus: "FAILED",
          externalMessageId: null,
          failureReason: "Provider rejected: invalid recipient",
          retryCount: 3,
        },
      };
      const job = buildJob(failedPayload);

      await processor.process(job);

      expect(emitter.emit).toHaveBeenCalledWith(CHANNEL_MESSAGE_CREATED_EVENT, {
        ticketId: "ticket-2",
        message: { ...failedPayload.message, createdAt: new Date("2024-01-01T00:00:00.000Z") },
      });
    });
  });
});
