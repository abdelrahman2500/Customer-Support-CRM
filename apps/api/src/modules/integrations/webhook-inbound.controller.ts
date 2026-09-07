import { Controller, HttpCode, Param, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/auth/public.decorator";
import { WebhookInboundService } from "./webhook-inbound.service";

/**
 * RM-21 — the generic inbound receiver `docs/architecture/09-integrations.md`
 * describes: "signature-verified, written to `integrations.webhook_logs`".
 * `@Public()` — no JWT is expected (a provider webhook carries no bearer
 * token); `@Throttle` mirrors `WebFormIntakeController`'s own tighter
 * (20/60s) rate limit, the established precedent for this codebase's
 * anonymous, unauthenticated write routes. `:providerKey` selects which
 * `WebhookVerifier` (`WebhookVerifierRegistry`) authenticates the request —
 * zero are registered today (see that registry's own doc comment), so every
 * real request currently rejects with 401, logged all the same.
 */
@ApiTags("integrations")
@Controller("integrations/webhooks")
export class WebhookInboundController {
  constructor(private readonly webhookInboundService: WebhookInboundService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post(":providerKey")
  async receive(
    @Param("providerKey") providerKey: string,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    // `rawBody` is populated by `NestFactory.create(AppModule, { rawBody: true })`
    // (main.ts) — the exact bytes a signature was computed over. Defaults
    // to an empty buffer only in the theoretical case of a body-less POST,
    // which every verifier will correctly treat as failing verification.
    const rawBody = request.rawBody ?? Buffer.alloc(0);
    await this.webhookInboundService.receive(providerKey, rawBody, request.headers);
    return { received: true };
  }
}
