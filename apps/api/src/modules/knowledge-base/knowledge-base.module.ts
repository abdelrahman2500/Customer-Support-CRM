import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { KnowledgeBaseController } from "./knowledge-base.controller";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { KbCategoriesController } from "./kb-categories.controller";
import { KbCategoriesService } from "./kb-categories.service";

/**
 * Owns the `knowledge_base` schema — see
 * docs/architecture/03-domain-boundaries.md ("Knowledge Base").
 * `TenantContext` is provided here the same way `SlaPoliciesModule`/
 * `TicketsModule` provide it.
 *
 * RM-27 — `KbCategoriesController`/`KbCategoriesService` registered
 * alongside the existing article controller/service, the same "one module
 * owns its whole schema" shape `TicketsModule` already established for
 * `TicketCategoriesController`/`TicketCategoriesService`.
 */
@Module({
  controllers: [KnowledgeBaseController, KbCategoriesController],
  providers: [KnowledgeBaseService, KbCategoriesService, TenantContext],
  exports: [KnowledgeBaseService, KbCategoriesService],
})
export class KnowledgeBaseModule {}
