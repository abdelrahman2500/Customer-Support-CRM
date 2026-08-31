import { Injectable } from "@nestjs/common";
import type {
  AiCallResult,
  AiChatMessageInput,
  AiProvider,
  AiTicketInput,
} from "./ai-provider.interface";

const DISABLED_RESULT: AiCallResult = {
  outcome: "DISABLED",
  text: null,
  model: "disabled",
  inputTokens: null,
  outputTokens: null,
  errorMessage: null,
};

/**
 * Story 72 — used whenever `ANTHROPIC_API_KEY` is unset (the default in
 * this repository today). Makes no network call and never throws — every
 * method resolves synchronously-fast with a `DISABLED` outcome, so
 * `AiGatewayService` can log it exactly like any other call rather than
 * needing a separate "AI is off" code path. This is the provider actually
 * active whenever `AiModule` loads in this repository's own dev/CI
 * environment (`CLAUDE.md` §5 — no fabricated credential exists here).
 */
@Injectable()
export class NullAiProvider implements AiProvider {
  async summarize(_ticket: AiTicketInput): Promise<AiCallResult> {
    return DISABLED_RESULT;
  }

  async suggestReply(_ticket: AiTicketInput): Promise<AiCallResult> {
    return DISABLED_RESULT;
  }

  async categorize(_ticket: AiTicketInput): Promise<AiCallResult> {
    return DISABLED_RESULT;
  }

  async chat(_input: AiChatMessageInput): Promise<AiCallResult> {
    return DISABLED_RESULT;
  }
}
