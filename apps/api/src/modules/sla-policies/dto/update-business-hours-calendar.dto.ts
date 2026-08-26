import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsOptional, ValidateNested } from "class-validator";
import { BusinessHoursDayDto } from "./business-hours-day.dto";

export class UpdateBusinessHoursCalendarDto {
  @ApiProperty({ required: false, type: [BusinessHoursDayDto], minItems: 7, maxItems: 7 })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BusinessHoursDayDto)
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  days?: BusinessHoursDayDto[];
}
