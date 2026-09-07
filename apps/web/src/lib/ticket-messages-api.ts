import { apiFetch } from "./api";

/**
 * Story 78 — Live Chat UI. Mirrors the backend's `ChannelMessageSummary`
 * exactly (`apps/api/src/modules/channels/channel-messages.service.ts`),
 * same file-per-sub-feature split as `attachments-api.ts` (Story 66/67).
 * `channelType` is typed loosely (`string`, not the backend's full 5-value
 * enum): Story 77 only ever produces `"LIVE_CHAT"`, and this UI never
 * branches on it — see that story's own "no other ChannelType gets a real
 * producer" non-goal.
 */
export interface ChannelMessageSummary {
  id: string;
  ticketId: string;
  channelType: string;
  direction: "INBOUND" | "OUTBOUND";
  senderContactId: string | null;
  senderUserId: string | null;
  body: string;
  createdAt: string;
  /** RM-13 — meaningful only for an `OUTBOUND` message on a future
   * externally-delivered channel (Email/WhatsApp/SMS); every Live
   * Chat/Web Form/AI_CHAT message is always `"DELIVERED"`. */
  deliveryStatus: "PENDING" | "SENT" | "DELIVERED" | "FAILED";
  externalMessageId: string | null;
  failureReason: string | null;
  retryCount: number;
}

/** Mirrors the existing `CreateChannelMessageDto` exactly
 * (`apps/api/src/modules/tickets/dto/create-channel-message.dto.ts`). */
export interface CreateChannelMessageInput {
  body: string;
}

/** `GET /tickets/:id/messages` (`ticket:read`) — returns `[]` when the
 * ticket has no messages yet (not a 404), mirroring `getTicketNotes`'s own
 * list-read convention. */
export function getTicketMessages(id: string): Promise<ChannelMessageSummary[]> {
  return apiFetch<ChannelMessageSummary[]>(`/tickets/${id}/messages`);
}

/** `POST /tickets/:id/messages` (`ticket:create`). */
export function createTicketMessage(
  id: string,
  input: CreateChannelMessageInput,
): Promise<ChannelMessageSummary> {
  return apiFetch<ChannelMessageSummary>(`/tickets/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** RM-15 — `POST /tickets/:id/messages/email` (`ticket:create`, same
 * permission as `createTicketMessage` above). Reuses the identical
 * request shape — only the channel differs. Resolves the moment the
 * message is created `PENDING`; its eventual `SENT`/`FAILED` transition
 * arrives over the existing realtime relay, same as every other message. */
export function createTicketEmailMessage(
  id: string,
  input: CreateChannelMessageInput,
): Promise<ChannelMessageSummary> {
  return apiFetch<ChannelMessageSummary>(`/tickets/${id}/messages/email`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface EmailChannelStatus {
  configured: boolean;
}

/** RM-15 — `GET /channels/email-status`. A capability signal, not
 * ticket-scoped data: whether `TicketChatCard` should offer a "send by
 * email" action at all. */
export function getEmailChannelStatus(): Promise<EmailChannelStatus> {
  return apiFetch<EmailChannelStatus>(`/channels/email-status`);
}
