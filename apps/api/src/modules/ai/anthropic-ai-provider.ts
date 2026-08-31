import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import type { EnvConfig } from "../../common/config/env.validation";
import type {
  AiCallResult,
  AiChatMessageInput,
  AiProvider,
  AiTicketInput,
} from "./ai-provider.interface";

const MAX_TOKENS = 1024;

/**
 * Story 72 — the real Anthropic-backed implementation named by
 * docs/architecture/07-sla-automation-and-ai.md ("The initial
 * implementation calls Anthropic Claude"). Only constructed by
 * `AiModule`'s factory provider when `ANTHROPIC_API_KEY` is present —
 * `NullAiProvider` is used otherwise, see that file's own doc comment.
 *
 * Every method reports failure through `AiCallResult.outcome`, never a
 * thrown error past this class — mirrors `AiProvider`'s own contract, and
 * matches how a caller wanting best-effort AI assistance should never
 * crash because a third-party API had a transient failure.
 */
@Injectable()
export class AnthropicAiProvider implements AiProvider {
  private readonly logger = new Logger(AnthropicAiProvider.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(configService: ConfigService<EnvConfig, true>) {
    this.model = configService.get("ANTHROPIC_MODEL", { infer: true });
    this.client = new Anthropic({
      apiKey: configService.get("ANTHROPIC_API_KEY", { infer: true }),
    });
  }

  async summarize(ticket: AiTicketInput): Promise<AiCallResult> {
    return this.complete(
      `Summarize the following support ticket in 2-3 sentences.\n\nSubject: ${ticket.subject}\n\n${ticket.body}`,
    );
  }

  async suggestReply(ticket: AiTicketInput): Promise<AiCallResult> {
    return this.complete(
      `Draft a helpful, professional reply to the following support ticket.\n\nSubject: ${ticket.subject}\n\n${ticket.body}`,
    );
  }

  async categorize(ticket: AiTicketInput): Promise<AiCallResult> {
    return this.complete(
      `Suggest a short (1-3 word) category for the following support ticket. Respond with only the category.\n\nSubject: ${ticket.subject}\n\n${ticket.body}`,
    );
  }

  async chat(input: AiChatMessageInput): Promise<AiCallResult> {
    return this.complete(input.message);
  }

  private async complete(prompt: string): Promise<AiCallResult> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
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
      this.logger.error("Anthropic API call failed", error as Error);
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
