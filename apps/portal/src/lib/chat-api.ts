import { apiFetch } from "./api";

/**
 * Story 80 — AI Portal Chatbot (Foundation). Mirrors the backend's
 * `ChatMessageSummary`/`AiChatResultResponse` exactly
 * (`apps/api/src/modules/ai/ai-chat.service.ts`), same independent
 * per-app re-declaration convention every other type in this app's
 * `lib/*-api.ts` files already follows.
 */
export interface ChatMessageSummary {
  id: string;
  role: "CUSTOMER" | "ASSISTANT";
  body: string;
  createdAt: string;
}

export interface ChatAiResult {
  id: string;
  outcome: "PENDING" | "SUCCESS" | "ERROR" | "DISABLED";
  outputText: string | null;
  errorMessage: string | null;
  createdAt: string;
}

/** `POST /portal/chat/sessions`. */
export function startChatSession(): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/portal/chat/sessions", { method: "POST" });
}

/** `POST /portal/chat/sessions/:id/messages`. */
export function sendChatMessage(
  sessionId: string,
  body: string,
): Promise<{ id: string; outcome: "PENDING" }> {
  return apiFetch(`/portal/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

/** `GET /portal/chat/sessions/:id/messages` — returns `[]` before any
 * message has been sent yet (not a 404). */
export function getChatMessages(sessionId: string): Promise<ChatMessageSummary[]> {
  return apiFetch<ChatMessageSummary[]>(`/portal/chat/sessions/${sessionId}/messages`);
}

/** `GET /portal/chat/sessions/:id/ai/:logId`. */
export function getChatAiResult(sessionId: string, logId: string): Promise<ChatAiResult> {
  return apiFetch<ChatAiResult>(`/portal/chat/sessions/${sessionId}/ai/${logId}`);
}
