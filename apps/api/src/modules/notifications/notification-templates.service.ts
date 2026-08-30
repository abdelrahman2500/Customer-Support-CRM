import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateNotificationTemplateDto } from "./dto/create-notification-template.dto";
import type { UpdateNotificationTemplateDto } from "./dto/update-notification-template.dto";

export interface NotificationTemplateSummary {
  id: string;
  eventType: string;
  template: string;
}

/**
 * Story 61 — grows `NotificationsModule` the same way
 * `NotificationPreferencesService` already did. Unlike that service,
 * `NotificationTemplate` is a branch-admin resource (never self-scoped) —
 * mirrors `SlaPoliciesService`'s exact `TenantContext.requireBranchScope()`/
 * `findXInScope` 404-masking CRUD shape.
 *
 * `@@unique([branchId, eventType])` on the model means "create" is really
 * create-or-update (`upsert`) — a second `POST` for the same event type
 * updates the existing row rather than erroring, since there is nothing
 * meaningfully different about "creating" vs. "replacing" a branch's one
 * template for a given event type.
 */
@Injectable()
export class NotificationTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createOrUpdateTemplate(
    dto: CreateNotificationTemplateDto,
  ): Promise<NotificationTemplateSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const template = await this.prisma.notificationTemplate.upsert({
      where: { branchId_eventType: { branchId, eventType: dto.eventType } },
      create: { branchId, eventType: dto.eventType, template: dto.template },
      update: { template: dto.template },
    });
    return toSummary(template);
  }

  async listTemplates(): Promise<NotificationTemplateSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const templates = await this.prisma.notificationTemplate.findMany({
      where: { branchId },
      orderBy: { eventType: "asc" },
    });
    return templates.map(toSummary);
  }

  async updateTemplate(
    id: string,
    dto: UpdateNotificationTemplateDto,
  ): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const existing = await this.prisma.notificationTemplate.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException("Notification template not found");
    }
    await this.prisma.notificationTemplate.update({
      where: { id },
      data: { template: dto.template },
    });
    return { id };
  }
}

function toSummary(template: {
  id: string;
  eventType: string;
  template: string;
}): NotificationTemplateSummary {
  return { id: template.id, eventType: template.eventType, template: template.template };
}
