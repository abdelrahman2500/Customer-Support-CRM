import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn } from "class-validator";
import { PORTAL_NOTIFICATION_EVENT_TYPES } from "../portal-notification-preferences.service";

export class UpdatePortalNotificationPreferenceDto {
  @ApiProperty({ enum: PORTAL_NOTIFICATION_EVENT_TYPES })
  @IsIn(PORTAL_NOTIFICATION_EVENT_TYPES)
  eventType!: string;

  @ApiProperty()
  @IsBoolean()
  inAppEnabled!: boolean;
}
