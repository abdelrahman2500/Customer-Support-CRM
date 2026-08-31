import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RealtimeGateway } from "./realtime.gateway";
import { AI_CHAT_MESSAGE_COMPLETED_EVENT } from "../modules/ai/ai-chat.events";
import type { AiChatMessageCompletedEvent } from "../modules/ai/ai-chat.events";

/**
 * Story 80 — relays `ai.chat_message_completed`
 * (`apps/api/src/modules/ai/ai-chat.events.ts`), emitted by
 * `AiProcessingEventsBridgeProcessor` once `apps/worker` resolves a chat
 * turn, into `chat-session:{id}`. Mirrors `TicketRealtimeListener`'s
 * exact `relay()` shape (`@Injectable()`, one `@OnEvent` handler,
 * try/catch, `Logger.error`, never rethrows), but uses a plain broadcast
 * rather than `emitToAgentsInRoom`: `chat-session:{id}` is customer-only
 * by construction (`RealtimeGateway.authorizeRoom` rejects an
 * agent-audience socket outright), so every socket in the room is
 * already the session's own Contact.
 */
@Injectable()
export class ChatRealtimeListener {
  private readonly logger = new Logger(ChatRealtimeListener.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(AI_CHAT_MESSAGE_COMPLETED_EVENT)
  onAiChatMessageCompleted(event: AiChatMessageCompletedEvent): void {
    try {
      this.gateway.server
        .to(`chat-session:${event.chatSessionId}`)
        .emit(AI_CHAT_MESSAGE_COMPLETED_EVENT, event);
    } catch (error) {
      this.logger.error(
        `Failed to relay ${AI_CHAT_MESSAGE_COMPLETED_EVENT} for chat session ${event.chatSessionId}`,
        error as Error,
      );
    }
  }
}
