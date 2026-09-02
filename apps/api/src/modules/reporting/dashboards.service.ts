import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, ReportWidgetType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateDashboardDto } from "./dto/create-dashboard.dto";
import type { UpdateDashboardDto } from "./dto/update-dashboard.dto";

export interface DashboardWidgetSummary {
  widgetType: ReportWidgetType;
  position: number;
}

export interface DashboardSummary {
  id: string;
  name: string;
  isShared: boolean;
  isOwner: boolean;
  widgets: DashboardWidgetSummary[];
}

/**
 * Story 110 — closes docs/architecture/03-domain-boundaries.md's named
 * "saved dashboards" gap. Lives inside the existing `ReportingModule`
 * alongside `ReportingService` (same domain), mirroring
 * `QuickRepliesService`'s own precedent of a second controller-facing
 * resource inside an existing module rather than a new one.
 *
 * Visibility rule, applied consistently across every read: a caller sees
 * a dashboard iff they own it OR it is `isShared: true` — no per-user
 * ACL exists anywhere in this codebase. Only the owner may ever write
 * (update/delete) one, shared or not: a non-owner's write attempt gets
 * the exact same `NotFoundException` a nonexistent id would (mirrors
 * `QuickRepliesService.updateQuickReply`'s identical ownership-via-404
 * convention — `ForbiddenException` appears nowhere in this codebase).
 */
@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createDashboard(dto: CreateDashboardDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const ownerUserId = this.requireAuthenticatedUserId();

    const dashboard = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reportDashboard.create({
        data: {
          branchId,
          ownerUserId,
          name: dto.name,
          isShared: dto.isShared ?? false,
        },
      });
      await tx.reportDashboardWidget.createMany({
        data: dto.widgetTypes.map((widgetType, position) => ({
          dashboardId: created.id,
          widgetType,
          position,
        })),
      });
      return created;
    });

    return { id: dashboard.id };
  }

  /** Own dashboards + every `isShared` one in the caller's branch. */
  async listDashboards(): Promise<DashboardSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const ownerUserId = this.tenantContext.userId;
    const dashboards = await this.prisma.reportDashboard.findMany({
      where: { branchId, ...visibilityFilter(ownerUserId) },
      include: { widgets: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return dashboards.map((dashboard) => toSummary(dashboard, ownerUserId));
  }

  async getDashboard(id: string): Promise<DashboardSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const ownerUserId = this.tenantContext.userId;
    const dashboard = await this.prisma.reportDashboard.findFirst({
      where: { id, branchId, ...visibilityFilter(ownerUserId) },
      include: { widgets: { orderBy: { position: "asc" } } },
    });
    if (!dashboard) {
      throw new NotFoundException("Dashboard not found");
    }
    return toSummary(dashboard, ownerUserId);
  }

  async updateDashboard(id: string, dto: UpdateDashboardDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const ownerUserId = this.requireAuthenticatedUserId();
    const existing = await this.prisma.reportDashboard.findFirst({
      where: { id, branchId, ownerUserId },
    });
    if (!existing) {
      throw new NotFoundException("Dashboard not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reportDashboard.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isShared !== undefined ? { isShared: dto.isShared } : {}),
        },
      });
      if (dto.widgetTypes !== undefined) {
        // Full replace — the same all-or-nothing shape `createDashboard`
        // uses, not an add/remove/reorder-in-place API.
        await tx.reportDashboardWidget.deleteMany({ where: { dashboardId: id } });
        await tx.reportDashboardWidget.createMany({
          data: dto.widgetTypes.map((widgetType, position) => ({
            dashboardId: id,
            widgetType,
            position,
          })),
        });
      }
    });

    return { id };
  }

  async deleteDashboard(id: string): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const ownerUserId = this.requireAuthenticatedUserId();
    const existing = await this.prisma.reportDashboard.findFirst({
      where: { id, branchId, ownerUserId },
    });
    if (!existing) {
      throw new NotFoundException("Dashboard not found");
    }

    await this.prisma.reportDashboard.delete({ where: { id } });
    return { id };
  }

  /** Mirrors `TicketChannelService`'s/`AttachmentsService`'s identical
   * `requireAuthenticatedUserId` convention (same error, same
   * `TenantContext.userId` source) — never actually reached in practice
   * since every route here sits behind `AuthGuard`. */
  private requireAuthenticatedUserId(): string {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no authenticated user on this request");
    }
    return userId;
  }
}

/**
 * `ownerUserId` is nullable on `TenantContext` (never actually null on a
 * real authenticated request, guarded by `AuthGuard`) — if it somehow
 * were, Prisma would treat an `undefined`-valued `ownerUserId` filter as
 * "omit this condition entirely" (matching every row), not "match
 * nothing", so the OR clause is built conditionally instead of ever
 * passing `undefined` into it.
 */
function visibilityFilter(ownerUserId: string | null): Prisma.ReportDashboardWhereInput {
  return ownerUserId ? { OR: [{ ownerUserId }, { isShared: true }] } : { isShared: true };
}

function toSummary(
  dashboard: Prisma.ReportDashboardGetPayload<{ include: { widgets: true } }>,
  callerUserId: string | null,
): DashboardSummary {
  return {
    id: dashboard.id,
    name: dashboard.name,
    isShared: dashboard.isShared,
    isOwner: dashboard.ownerUserId === callerUserId,
    widgets: dashboard.widgets
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((widget) => ({ widgetType: widget.widgetType, position: widget.position })),
  };
}
