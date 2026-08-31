import { Module } from "@nestjs/common";
import { AiGatewayService } from "./ai-gateway.service";

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
 */
@Module({
  providers: [AiGatewayService],
  exports: [AiGatewayService],
})
export class AiModule {}
