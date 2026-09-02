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

/** Story 116 — one prior turn in the same chat session, oldest-to-newest
 * order, excluding the current `AiChatMessageInput.message`. `"user"`/
 * `"assistant"` (not `ChatMessageRole`'s own `CUSTOMER`/`ASSISTANT`
 * values) — this package must not depend on `@prisma/client`, and these
 * are also the exact role labels the Anthropic Messages API itself
 * expects. */
export interface AiChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Story 116 — `history` is required, not optional: this interface has
 * exactly three call sites in this repository (`AnthropicAiProvider`,
 * `NullAiProvider`, `AiProcessingProcessor`), all updated together in
 * that same story — there is no external consumer of this internal
 * package's types to stay backward compatible with by making it
 * optional. A session's first-ever message passes an empty array, not a
 * missing field.
 *
 * Story 117 — `context` follows the exact same "required, three call
 * sites, all updated together" reasoning: pre-truncated Knowledge Base
 * excerpt strings (`"title: body excerpt"`), already scoped/searched by
 * the caller (`AiProcessingProcessor`). An empty array means "no
 * grounding content found (or KB search failed)" — the chat proceeds
 * exactly like before this story existed, never a missing field. */
export interface AiChatMessageInput {
  sessionId: string;
  message: string;
  history: AiChatTurn[];
  context: string[];
}
