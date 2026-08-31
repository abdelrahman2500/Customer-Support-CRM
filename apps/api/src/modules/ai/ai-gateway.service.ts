import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AiCallResult, AiChatMessageInput, AiProvider, AiTicketInput } from "@crm/ai";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_PROVIDER } from "./ai.constants";

/**
 * Story 72 — the single exported entry point a future story (80-84) calls;
 * nothing outside `AiModule` ever touches `AnthropicAiProvider`/
 * `NullAiProvider` directly (docs/architecture/07-sla-automation-and-ai.md:
 * "Provider swaps implement the interface without changing call sites").
 *
 * Architecture-boundary refactor — the `AiProvider` interface/types and
 * both implementations now live in `@crm/ai` (a framework-neutral
 * workspace package `apps/worker` can depend on too), not in this
 * module. This service, the `AI_PROVIDER` DI token, and `AiPromptLog`
 * persistence deliberately stay here — see `@crm/ai`'s own `index.ts`
 * doc comment for the exact boundary.
 *
 * Every call unconditionally writes exactly one `AiPromptLog` row — success,
 * error, or disabled — before returning, so "log outcomes for retry and
 * inspection" (the architecture doc's own words, stated for Notifications
 * and mirrored here) holds even for a caller that never inspects the log
 * itself. `branchId` is an explicit parameter, not resolved from
 * `TenantContext` — see the plan's Design item 6. This is why the class
 * does not literally `implements AiProvider`: every method's real
 * signature adds a required `branchId` the interface itself has no need
 * for (only `AiGatewayService` logs, so only it needs branch scope).
 */
@Injectable()
export class AiGatewayService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly prisma: PrismaService,
  ) {}

  async summarize(ticket: AiTicketInput, branchId: string): Promise<AiCallResult> {
    return this.run("SUMMARIZE", branchId, promptRef(ticket.subject, ticket.body), () =>
      this.provider.summarize(ticket),
    );
  }

  async suggestReply(ticket: AiTicketInput, branchId: string): Promise<AiCallResult> {
    return this.run("SUGGEST_REPLY", branchId, promptRef(ticket.subject, ticket.body), () =>
      this.provider.suggestReply(ticket),
    );
  }

  async categorize(ticket: AiTicketInput, branchId: string): Promise<AiCallResult> {
    return this.run("CATEGORIZE", branchId, promptRef(ticket.subject, ticket.body), () =>
      this.provider.categorize(ticket),
    );
  }

  async chat(input: AiChatMessageInput, branchId: string): Promise<AiCallResult> {
    return this.run("CHAT", branchId, promptRef(input.sessionId, input.message), () =>
      this.provider.chat(input),
    );
  }

  private async run(
    feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE" | "CHAT",
    branchId: string,
    promptRefValue: string,
    call: () => Promise<AiCallResult>,
  ): Promise<AiCallResult> {
    const startedAt = Date.now();
    let result: AiCallResult;
    try {
      result = await call();
    } catch (error) {
      // The `AiProvider` contract says implementations never throw, but a
      // future/misbehaving provider still shouldn't take this gateway's
      // own logging guarantee down with it.
      result = {
        outcome: "ERROR",
        text: null,
        model: "unknown",
        inputTokens: null,
        outputTokens: null,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
    const latencyMs = Date.now() - startedAt;

    await this.prisma.aiPromptLog.create({
      data: {
        branchId,
        feature,
        model: result.model,
        promptRef: promptRefValue,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs,
        outcome: result.outcome,
        errorMessage: result.errorMessage,
      },
    });

    return result;
  }
}

/** A short opaque reference, never the raw prompt body — see
 * `AiPromptLog`'s own doc comment in schema.prisma for why. */
function promptRef(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 16);
}
