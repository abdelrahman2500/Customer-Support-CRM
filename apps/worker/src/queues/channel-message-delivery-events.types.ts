import type { ChannelType, ChannelMessageDeliveryStatus, ChannelMessageDirection } from "@prisma/client";

/**
 * Must stay identical to the corresponding declarations in
 * apps/api/src/queues/channel-message-delivery-events-bridge.processor.ts
 * — no cross-app shared-constants/types mechanism exists in this
 * repository (Story 14's own precedent), so these are deliberately
 * duplicated.
 */
export const CHANNEL_MESSAGE_DELIVERY_EVENTS_QUEUE = "channel-message-delivery-events";

/** Mirrors `apps/api`'s own `ChannelMessageSummary` shape exactly (same
 * per-app re-declaration convention `AiProcessingJobPayload` etc. already
 * use throughout `apps/worker`) — this processor already has the full,
 * just-updated row after its own Prisma write and hands it along so
 * `apps/api`'s bridge processor never needs a second query to build the
 * event payload it relays. */
export interface ChannelMessageSummaryPayload {
  id: string;
  ticketId: string;
  channelType: ChannelType;
  direction: ChannelMessageDirection;
  senderContactId: string | null;
  senderUserId: string | null;
  body: string;
  createdAt: string;
  deliveryStatus: ChannelMessageDeliveryStatus;
  externalMessageId: string | null;
  failureReason: string | null;
  retryCount: number;
}

export interface ChannelMessageDeliveryOutcomeJobPayload {
  ticketId: string;
  message: ChannelMessageSummaryPayload;
}
