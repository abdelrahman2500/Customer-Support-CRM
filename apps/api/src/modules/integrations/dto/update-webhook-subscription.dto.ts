import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsUrl } from "class-validator";
import { WEBHOOK_EVENT_TYPES } from "../webhook-event-types";

export class UpdateWebhookSubscriptionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  targetUrl?: string;

  @ApiProperty({ required: false, enum: WEBHOOK_EVENT_TYPES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  subscribedEventTypes?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
