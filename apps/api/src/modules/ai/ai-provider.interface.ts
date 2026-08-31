/**
 * Story 72 — AI Services Foundation. Exact method names from
 * docs/architecture/07-sla-automation-and-ai.md ("`AiModule` exposes an
 * internal `AiProvider` interface with methods such as `summarize(ticket)`,
 * `suggestReply(ticket)`, `categorize(ticket)`, and `chat(session,
 * message)`"). Deliberately provider-agnostic and generic: no downstream
 * caller exists yet (Stories 80-84) to demand a richer per-feature result
 * shape, so every method returns the same `AiCallResult`.
 *
 * Implementations (`AnthropicAiProvider`, `NullAiProvider`) must never
 * throw for an expected "not configured"/"provider error" condition — they
 * report it via `AiCallResult.outcome`, exactly like `AiGatewayService`'s
 * own logging wrapper expects, so a real provider failure never crashes a
 * caller that only wants best-effort AI assistance.
 */
export interface AiCallResult {
  outcome: "SUCCESS" | "ERROR" | "DISABLED";
  text: string | null;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  errorMessage: string | null;
}

/** A ticket summarize/suggest-reply/categorize call takes only the free
 * text this foundation slice actually needs — never the full `Ticket`
 * Prisma model, so `AiModule` never depends on `TicketsModule`'s internal
 * shape (only a future consuming story wires the two together). */
export interface AiTicketInput {
  subject: string;
  body: string;
}

export interface AiChatMessageInput {
  sessionId: string;
  message: string;
}

export interface AiProvider {
  summarize(ticket: AiTicketInput): Promise<AiCallResult>;
  suggestReply(ticket: AiTicketInput): Promise<AiCallResult>;
  categorize(ticket: AiTicketInput): Promise<AiCallResult>;
  chat(input: AiChatMessageInput): Promise<AiCallResult>;
}
