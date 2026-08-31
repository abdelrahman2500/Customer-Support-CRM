import type { ChannelMessageSummary } from "./channel-messages.service";

/** Mirrors `../tickets/tickets.events.ts`'s own per-domain placement/shape
 * exactly (e.g. `TICKET_NOTE_ADDED_EVENT`). */
export const CHANNEL_MESSAGE_CREATED_EVENT = "channel.message.created";

/** `TicketRealtimeListener` relays this verbatim into `ticket:{id}` — both
 * the agent and (Story 77) the ticket's own customer are meant to receive
 * a chat message, unlike `ticket.note-added`/`ticket.escalated`/
 * `ai.prompt_completed`, which stay agent-only. */
export interface ChannelMessageCreatedEvent {
  ticketId: string;
  message: ChannelMessageSummary;
}
