import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateNotificationTemplateDto } from "./dto/create-notification-template.dto";
import { UpdateNotificationTemplateDto } from "./dto/update-notification-template.dto";
import type { NotificationTemplateSummary } from "./notification-templates.service";
import { NotificationTemplatesService } from "./notification-templates.service";

/** Story 61 — branch-admin resource, unlike `NotificationPreferencesController`
 * (self-scoped). Reuses the existing `notification:read` permission for
 * `GET`; `notification:create`/`notification:update` gate writes — mirrors
 * `sla:create`/`sla:read`/`sla:update`'s exact three-permission shape. */
@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notification-templates")
export class NotificationTemplatesController {
  constructor(private readonly notificationTemplatesService: NotificationTemplatesService) {}

  @Post()
  @RequirePermissions("notification:create")
  create(@Body() dto: CreateNotificationTemplateDto): Promise<NotificationTemplateSummary> {
    return this.notificationTemplatesService.createOrUpdateTemplate(dto);
  }

  @Get()
  @RequirePermissions("notification:read")
  list(): Promise<NotificationTemplateSummary[]> {
    return this.notificationTemplatesService.listTemplates();
  }

  @Patch(":id")
  @RequirePermissions("notification:update")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ): Promise<{ id: string }> {
    return this.notificationTemplatesService.updateTemplate(id, dto);
  }
}
