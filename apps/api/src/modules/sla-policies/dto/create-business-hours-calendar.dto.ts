import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from "class-validator";
import { BusinessHoursDayDto } from "./business-hours-day.dto";

export class CreateBusinessHoursCalendarDto {
  @ApiProperty({ type: [BusinessHoursDayDto], minItems: 7, maxItems: 7 })
  @ValidateNested({ each: true })
  @Type(() => BusinessHoursDayDto)
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  days!: BusinessHoursDayDto[];
}
