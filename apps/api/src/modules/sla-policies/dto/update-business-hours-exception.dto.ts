import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateBusinessHoursExceptionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @ApiProperty({ required: false, minimum: 0, maximum: 1439 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  overrideStartMinute?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 1439 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  overrideEndMinute?: number;
}
