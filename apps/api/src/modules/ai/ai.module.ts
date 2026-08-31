import { Module } from "@nestjs/common";
import { QueuesModule } from "../../queues/queues.module";
import { AiGatewayService } from "./ai-gateway.service";
import { AiChatService } from "./ai-chat.service";

/**
 * Owns the `ai` schema — see docs/architecture/03-domain-boundaries.md
 * ("AI Services"). Story 72 — foundation; no controller (still true).
 *
 * Story 76 — no longer constructs an `AiProvider`/`AI_PROVIDER` token
 * here: `apps/api` never calls the AI provider directly anymore (that
 * would violate docs/architecture/02-system-architecture-overview.md's
 * "never blocks a request on slow external work... calling the AI
 * provider"). Provider construction/selection now lives only in
 * `apps/worker`'s `AiProviderModule`
 * (apps/worker/src/ai/ai-provider.module.ts) — the one place that
 * actually calls it. Keeping a synchronous-call capability here, even
 * unused, would be an architecture footgun; removing it is the
 * structural guarantee, not just avoiding invoking it in this one case.
 * Story 80's `AiChatService` still never calls `AiProvider` directly —
 * it submits to the same `ai-processing` queue `TicketAiService` already
 * does, so this guarantee is unbroken.
 *
 * Story 80 — `QueuesModule` imported (mirrors `TicketsModule`'s own
 * import) so `AiChatService` can inject `AiProcessingProducer` directly.
 * `AiChatService` is exported (unlike `AiGatewayService`, which has no
 * cross-module caller) — `PortalModule`'s `PortalChatController` calls
 * its Contact-scoped methods directly, mirroring how `PortalTicketsService`
 * already calls `TicketsService`'s own customer-scoped methods.
 */
@Module({
  imports: [QueuesModule],
  providers: [AiGatewayService, AiChatService],
  exports: [AiGatewayService, AiChatService],
})
export class AiModule {}
