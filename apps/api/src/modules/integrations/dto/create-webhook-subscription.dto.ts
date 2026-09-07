import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsUrl } from "class-validator";
import { WEBHOOK_EVENT_TYPES } from "../webhook-event-types";

export class CreateWebhookSubscriptionDto {
  @ApiProperty()
  @IsUrl({ require_tld: false, require_protocol: true })
  targetUrl!: string;

  @ApiProperty({ enum: WEBHOOK_EVENT_TYPES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  subscribedEventTypes!: string[];
}
