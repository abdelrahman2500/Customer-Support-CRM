/**
 * Extracted from `apps/api/src/modules/ai/ai-provider.interface.ts`
 * (Story 72) into this framework-neutral package (architecture-boundary
 * refactor) so `apps/worker` can construct the same provider
 * implementations without duplicating them — see
 * docs/architecture/02-system-architecture-overview.md ("Shares
 * domain/service code with apps/api via internal packages so business
 * logic is not duplicated").
 *
 * Deliberately provider-agnostic and generic: no downstream caller
 * demands a richer per-feature result shape, so every `AiProvider`
 * method returns the same `AiCallResult`.
 *
 * Implementations (`AnthropicAiProvider`, `NullAiProvider`) must never
 * throw for an expected "not configured"/"provider error" condition —
 * they report it via `AiCallResult.outcome` instead, exactly like
 * `apps/api`'s `AiGatewayService` logging wrapper expects, so a caller
 * that only wants best-effort AI assistance never crashes because of a
 * third-party failure.
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
 * text this contract actually needs — never a full `Ticket` shape, so
 * this package never depends on any app's domain models. */
export interface AiTicketInput {
  subject: string;
  body: string;
}

export interface AiChatMessageInput {
  sessionId: string;
  message: string;
}
