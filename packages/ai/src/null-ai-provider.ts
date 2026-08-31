import type { AiProvider } from "./ai-provider.interface";
import type { AiCallResult, AiChatMessageInput, AiTicketInput } from "./types";

const DISABLED_RESULT: AiCallResult = {
  outcome: "DISABLED",
  text: null,
  model: "disabled",
  inputTokens: null,
  outputTokens: null,
  errorMessage: null,
};

/**
 * Moved out of `apps/api/src/modules/ai/null-ai-provider.ts` (Story 72)
 * unchanged, other than dropping the `@nestjs/common` `@Injectable()`
 * decorator this framework-neutral package must not depend on. Used
 * whenever no Anthropic credential is configured — in either `apps/api`
 * or `apps/worker`. Makes no network call and never throws; every
 * method resolves synchronously-fast with a `DISABLED` outcome, so a
 * caller can log it exactly like any other call rather than needing a
 * separate "AI is off" code path.
 */
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
