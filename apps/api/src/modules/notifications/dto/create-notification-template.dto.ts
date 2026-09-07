import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { NOTIFICATION_EVENT_TYPES } from "../notification-preferences.service";

export class CreateNotificationTemplateDto {
  @ApiProperty({ enum: NOTIFICATION_EVENT_TYPES })
  @IsIn(NOTIFICATION_EVENT_TYPES)
  eventType!: string;

  /** RM-30 — omitted means "shown to every viewer regardless of locale"
   * (this field's own default, and this model's original behavior).
   * `["en", "ar"]` are `apps/web/src/i18n/routing.ts`'s own configured
   * locales — mirrors `UpdateLocaleDto`'s exact precedent. */
  @ApiProperty({ required: false, enum: ["en", "ar"] })
  @IsOptional()
  @IsIn(["en", "ar"])
  locale?: "en" | "ar";

  @ApiProperty()
  @IsString()
  @MinLength(1)
  template!: string;
}
