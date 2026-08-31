import { Module } from "@nestjs/common";
import { AuthModule } from "../../common/auth/auth.module";
import { TicketsModule } from "../tickets/tickets.module";
import { KnowledgeBaseModule } from "../knowledge-base/knowledge-base.module";
import { AiModule } from "../ai/ai.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";
import { PortalTicketsController } from "./portal-tickets.controller";
import { PortalTicketsService } from "./portal-tickets.service";
import { PortalKnowledgeBaseController } from "./portal-knowledge-base.controller";
import { PortalChatController } from "./portal-chat.controller";

/**
 * Story 52 — the Customer Portal's first module. `AuthModule` provides the
 * `JwtService` this module signs/verifies **access** tokens with (the same
 * pattern `IdentityModule` already uses) — refresh tokens are hashed
 * directly in `PortalService` with a separate secret, exactly like
 * `IdentityService`'s own refresh-token mechanism.
 *
 * Story 53 — `TicketsModule` imported so `PortalTicketsService` can inject
 * the already-exported `TicketsService` directly (see that service's
 * additive, customer-scoped methods) rather than reimplementing ticket
 * creation/lookup.
 *
 * Story 54 — `KnowledgeBaseModule` imported the same way, so
 * `PortalKnowledgeBaseController` can inject `KnowledgeBaseService`
 * directly (no intermediate service layer needed — see that controller's
 * own doc comment).
 *
 * Story 80 — `AiModule` imported the same way, so `PortalChatController`
 * can inject the already-exported `AiChatService` directly, mirroring
 * `PortalKnowledgeBaseController`'s own no-intermediate-service pattern.
 */
@Module({
  imports: [AuthModule, TicketsModule, KnowledgeBaseModule, AiModule],
  controllers: [
    PortalController,
    PortalTicketsController,
    PortalKnowledgeBaseController,
    PortalChatController,
  ],
  providers: [PortalService, PortalTicketsService],
  exports: [PortalService],
})
export class PortalModule {}
