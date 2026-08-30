import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, MinLength } from "class-validator";
import { NOTIFICATION_EVENT_TYPES } from "../notification-preferences.service";

export class CreateNotificationTemplateDto {
  @ApiProperty({ enum: NOTIFICATION_EVENT_TYPES })
  @IsIn(NOTIFICATION_EVENT_TYPES)
  eventType!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  template!: string;
}
