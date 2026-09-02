import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { AttachmentsController } from "./attachments.controller";
import { CustomerAttachmentsController } from "./customer-attachments.controller";
import { AttachmentsService } from "./attachments.service";
import { S3StorageService } from "./s3-storage.service";

/** Story 66 — a new top-level module, not folded into `CustomersModule` or
 * `TicketsModule` (plan Design item 2). `TenantContext` is provided here
 * the same way `KnowledgeBaseModule`/`SlaPoliciesModule`/`TicketsModule`
 * each provide it.
 *
 * Story 67 — `CustomerAttachmentsController` registered alongside
 * `AttachmentsController`, sharing the same `AttachmentsService`/
 * `S3StorageService` (plan Design item 3). */
@Module({
  controllers: [AttachmentsController, CustomerAttachmentsController],
  providers: [AttachmentsService, S3StorageService, TenantContext],
  // Story 103 — `PortalModule` imports this module so `PortalTicketsService`
  // can inject `AttachmentsService` directly, mirroring how it already
  // injects `TicketsService`/`TicketChannelService`/`AiChatService`.
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
