import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateDashboardDto } from "./dto/create-dashboard.dto";
import { UpdateDashboardDto } from "./dto/update-dashboard.dto";
import type { DashboardSummary } from "./dashboards.service";
import { DashboardsService } from "./dashboards.service";

/**
 * Story 110 — closes docs/architecture/03-domain-boundaries.md's named
 * "saved dashboards" gap. Reuses the existing `report:read` permission
 * for every route, including writes — a dashboard is a saved arrangement
 * of reports the caller can already query directly (personal config,
 * like `NotificationPreference`), not curated cross-role content that
 * would warrant its own `create`/`update` permission key
 * (`QuickReply`/`AutomationRule`'s precedent). Lives alongside
 * `ReportingController` in the same `ReportingModule`.
 */
@ApiTags("reporting")
@ApiBearerAuth()
@Controller("reports/dashboards")
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  @RequirePermissions("report:read")
  createDashboard(@Body() dto: CreateDashboardDto): Promise<{ id: string }> {
    return this.dashboardsService.createDashboard(dto);
  }

  @Get()
  @RequirePermissions("report:read")
  listDashboards(): Promise<DashboardSummary[]> {
    return this.dashboardsService.listDashboards();
  }

  @Get(":id")
  @RequirePermissions("report:read")
  getDashboard(@Param("id") id: string): Promise<DashboardSummary> {
    return this.dashboardsService.getDashboard(id);
  }

  @Patch(":id")
  @RequirePermissions("report:read")
  updateDashboard(
    @Param("id") id: string,
    @Body() dto: UpdateDashboardDto,
  ): Promise<{ id: string }> {
    return this.dashboardsService.updateDashboard(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("report:read")
  deleteDashboard(@Param("id") id: string): Promise<{ id: string }> {
    return this.dashboardsService.deleteDashboard(id);
  }
}
