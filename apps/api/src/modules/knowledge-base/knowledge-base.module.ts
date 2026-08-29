import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { KnowledgeBaseController } from "./knowledge-base.controller";
import { KnowledgeBaseService } from "./knowledge-base.service";

/**
 * Owns the `knowledge_base` schema — see
 * docs/architecture/03-domain-boundaries.md ("Knowledge Base").
 * `TenantContext` is provided here the same way `SlaPoliciesModule`/
 * `TicketsModule` provide it.
 */
@Module({
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, TenantContext],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
