import type { AiCallResult, AiChatMessageInput, AiTicketInput } from "./types";

/**
 * Exact method names from docs/architecture/07-sla-automation-and-ai.md
 * ("`AiModule` exposes an internal `AiProvider` interface with methods
 * such as `summarize(ticket)`, `suggestReply(ticket)`, `categorize
 * (ticket)`, and `chat(session, message)`"). Originally defined in
 * `apps/api/src/modules/ai/ai-provider.interface.ts` (Story 72); moved
 * here so both `apps/api` and `apps/worker` depend on exactly one
 * definition.
 */
export interface AiProvider {
  summarize(ticket: AiTicketInput): Promise<AiCallResult>;
  suggestReply(ticket: AiTicketInput): Promise<AiCallResult>;
  categorize(ticket: AiTicketInput): Promise<AiCallResult>;
  chat(input: AiChatMessageInput): Promise<AiCallResult>;
}
