import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn } from "class-validator";
import { NOTIFICATION_EVENT_TYPES } from "../notification-preferences.service";

export class UpdateNotificationPreferenceDto {
  @ApiProperty({ enum: NOTIFICATION_EVENT_TYPES })
  @IsIn(NOTIFICATION_EVENT_TYPES)
  eventType!: string;

  @ApiProperty()
  @IsBoolean()
  inAppEnabled!: boolean;
}
