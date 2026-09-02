import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider } from "./ai-provider.interface";
import type { AiCallResult, AiChatMessageInput, AiTicketInput } from "./types";

const MAX_TOKENS = 1024;

/**
 * Plain configuration `AnthropicAiProvider` is constructed with — no
 * `ConfigService`, no env validation, no `@nestjs/*` import anywhere in
 * this package. Each consuming app (`apps/api`, `apps/worker`) owns and
 * validates its own environment, then passes the two resolved values
 * straight through — this is the architecture-boundary refactor's whole
 * point (see this package's own `README`-equivalent doc comment in
 * `index.ts`).
 */
export interface AnthropicAiProviderConfig {
  apiKey: string;
  model: string;
}

/**
 * The real Anthropic-backed implementation named by
 * docs/architecture/07-sla-automation-and-ai.md ("The initial
 * implementation calls Anthropic Claude"). Framework-neutral by design —
 * moved out of `apps/api/src/modules/ai/anthropic-ai-provider.ts`
 * (Story 72) into this package specifically so `apps/worker` can
 * construct the identical class from its own already-validated config,
 * with the actual `@anthropic-ai/sdk` usage living in exactly one place
 * (docs/architecture/02-system-architecture-overview.md: "Shares
 * domain/service code with apps/api via internal packages so business
 * logic is not duplicated").
 *
 * Every method reports failure through `AiCallResult.outcome`, never a
 * thrown error past this class — mirrors `AiProvider`'s own contract,
 * unchanged from Story 72.
 *
 * Logging note: the pre-refactor `apps/api`-only version logged a
 * failed call via Nest's `Logger` — this package must not import
 * `@nestjs/common`, so a plain `console.error` is the framework-neutral
 * equivalent. The actual error is still always captured in
 * `AiCallResult.errorMessage` regardless (and, in `apps/api`, in
 * `AiPromptLog` via `AiGatewayService` — unchanged).
 */
export class AnthropicAiProvider implements AiProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: AnthropicAiProviderConfig) {
    this.model = config.model;
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async summarize(ticket: AiTicketInput): Promise<AiCallResult> {
    return this.complete([
      {
        role: "user",
        content: `Summarize the following support ticket in 2-3 sentences.\n\nSubject: ${ticket.subject}\n\n${ticket.body}`,
      },
    ]);
  }

  async suggestReply(ticket: AiTicketInput): Promise<AiCallResult> {
    return this.complete([
      {
        role: "user",
        content: `Draft a helpful, professional reply to the following support ticket.\n\nSubject: ${ticket.subject}\n\n${ticket.body}`,
      },
    ]);
  }

  async categorize(ticket: AiTicketInput): Promise<AiCallResult> {
    return this.complete([
      {
        role: "user",
        content: `Suggest a short (1-3 word) category for the following support ticket. Respond with only the category.\n\nSubject: ${ticket.subject}\n\n${ticket.body}`,
      },
    ]);
  }

  /** Story 116 — includes the session's prior turns (oldest-first, fetched
   * and capped by the caller — see `AiProcessingProcessor`) before the
   * current message, so the model actually has conversation context
   * instead of treating every turn as a fresh, isolated prompt. */
  async chat(input: AiChatMessageInput): Promise<AiCallResult> {
    return this.complete([
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: input.message },
    ]);
  }

  /** Story 116 — generalized from a single prompt string to a full
   * message array so `chat()` can include prior turns; `summarize`/
   * `suggestReply`/`categorize` each wrap their existing single prompt as
   * a one-element array — an identical resulting API call, just
   * expressed as the general case. */
  private async complete(messages: Anthropic.MessageParam[]): Promise<AiCallResult> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        messages,
      });
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      return {
        outcome: "SUCCESS",
        text,
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        errorMessage: null,
      };
    } catch (error) {
      console.error("Anthropic API call failed", error);
      return {
        outcome: "ERROR",
        text: null,
        model: this.model,
        inputTokens: null,
        outputTokens: null,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
