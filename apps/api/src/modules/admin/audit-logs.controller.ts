import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";
import type { AuditLogSummary } from "./audit-logs.service";
import { AuditLogsService } from "./audit-logs.service";

/** Story 37 — read-only.
 *
 * Story 104 — `action`/`entityType`/`actorId`/date-range filtering, and a
 * fixed result cap, mirrors `CustomersController.list`'s own
 * `@Query() query: <Dto>` shape (Story 101). */
@ApiTags("admin")
@ApiBearerAuth()
@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions("audit:read")
  list(@Query() query: ListAuditLogsQueryDto): Promise<AuditLogSummary[]> {
    return this.auditLogsService.listAuditLogs(query);
  }
}
