import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateNotificationTemplateDto {
  /**
   * Story 130 — now optional. It was required when `template` was the only
   * editable field; the lifecycle toggle below has to be sendable on its
   * own (`PATCH { isActive: false }`), exactly as `UpdateAutomationRuleDto`
   * and every other update DTO in this codebase already allow. A body with
   * neither field is a no-op rather than an error, matching those siblings.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  template?: string;

  /** Story 130 — deactivating a template is how it is retired; this model
   * has no hard `DELETE` (see `NotificationTemplate`'s own doc comment). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
