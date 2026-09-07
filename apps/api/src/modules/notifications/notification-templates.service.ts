import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateNotificationTemplateDto } from "./dto/create-notification-template.dto";
import type { UpdateNotificationTemplateDto } from "./dto/update-notification-template.dto";

export interface NotificationTemplateSummary {
  id: string;
  eventType: string;
  /** RM-30 — `null` means "shown to every viewer regardless of locale". */
  locale: string | null;
  template: string;
}

/**
 * Story 61 — grows `NotificationsModule` the same way
 * `NotificationPreferencesService` already did. Unlike that service,
 * `NotificationTemplate` is a branch-admin resource (never self-scoped) —
 * mirrors `SlaPoliciesService`'s exact `TenantContext.requireBranchScope()`/
 * `findXInScope` 404-masking CRUD shape.
 *
 * RM-30 — "create" is still really create-or-update, now keyed on
 * `(branchId, eventType, locale)` rather than just `(branchId,
 * eventType)` — a second `POST` for the same event type AND locale
 * updates that existing row rather than erroring; the same event type
 * with a *different* locale is a distinct row (an admin's
 * locale-specific override, layered on top of the default). No longer a
 * typed Prisma `upsert`: the model's own real uniqueness invariant is an
 * expression index Prisma's schema DSL can't represent (see
 * `NotificationTemplate`'s own doc comment), so this looks the existing
 * row up with a plain `findFirst` first, mirroring this codebase's more
 * common "findXInScope, then branch on found/not-found" convention
 * instead.
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
    const locale = dto.locale ?? null;
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: { branchId, eventType: dto.eventType, locale },
    });
    const template = existing
      ? await this.prisma.notificationTemplate.update({
          where: { id: existing.id },
          data: { template: dto.template },
        })
      : await this.prisma.notificationTemplate.create({
          data: { branchId, eventType: dto.eventType, locale, template: dto.template },
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
  locale: string | null;
  template: string;
}): NotificationTemplateSummary {
  return {
    id: template.id,
    eventType: template.eventType,
    locale: template.locale,
    template: template.template,
  };
}
