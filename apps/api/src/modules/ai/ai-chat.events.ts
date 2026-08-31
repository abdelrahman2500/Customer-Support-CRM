/**
 * Story 80 — the chat-scoped counterpart to `./ai.events.ts`'s
 * `ai.prompt_completed`, mirroring its exact shape/placement. Kept as a
 * separate event/type (not a widened `AiPromptCompletedEvent`) because
 * its identifying field is `chatSessionId`, not `ticketId`, and it is
 * relayed into a different room (`chat-session:{id}`, never
 * `ticket:{id}`) by a different listener (`ChatRealtimeListener`, never
 * `TicketRealtimeListener`) — keeping the two fully independent means
 * neither event/listener/room needs to branch on the other's shape.
 */
export const AI_CHAT_MESSAGE_COMPLETED_EVENT = "ai.chat_message_completed";

/** Never the reply text itself — the durable `AiPromptLog` row (looked up
 * by `aiPromptLogId`) remains the source of truth, and a successful
 * reply's text is additionally in the `ChatMessage` list (`GET
 * /portal/chat/sessions/:id/messages`). This is only enough for an
 * already-authorized socket watching `chat-session:{id}` to know a turn
 * resolved and which operation it was. */
export interface AiChatMessageCompletedEvent {
  aiPromptLogId: string;
  chatSessionId: string;
  outcome: "SUCCESS" | "ERROR" | "DISABLED";
}
