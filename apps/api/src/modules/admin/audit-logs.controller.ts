import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type { AuditLogSummary } from "./audit-logs.service";
import { AuditLogsService } from "./audit-logs.service";

/** Story 37 — read-only. No pagination/filtering, matching every other
 * list endpoint in this codebase. */
@ApiTags("admin")
@ApiBearerAuth()
@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions("audit:read")
  list(): Promise<AuditLogSummary[]> {
    return this.auditLogsService.listAuditLogs();
  }
}
