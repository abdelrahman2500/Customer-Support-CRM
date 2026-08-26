import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * `isClosed` defaults to `true` when omitted (a plain closure — the common
 * case, e.g. a public holiday). Setting it to `false` requires
 * `overrideStartMinute`/`overrideEndMinute` (an overridden-hours day, e.g.
 * a half-day) — enforced in `BusinessHoursCalendarsService`, mirroring
 * `BusinessHoursDayDto`'s own split between per-field and cross-field checks.
 */
export class CreateBusinessHoursExceptionDto {
  @ApiProperty({ example: "2026-12-25", description: "YYYY-MM-DD" })
  @IsDateString()
  date!: string;

  @ApiProperty({ required: false, default: true })
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
