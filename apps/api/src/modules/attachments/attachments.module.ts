import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";
import { S3StorageService } from "./s3-storage.service";

/** Story 66 — a new top-level module, not folded into `CustomersModule` or
 * `TicketsModule` (plan Design item 2). `TenantContext` is provided here
 * the same way `KnowledgeBaseModule`/`SlaPoliciesModule`/`TicketsModule`
 * each provide it. */
@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, S3StorageService, TenantContext],
})
export class AttachmentsModule {}
