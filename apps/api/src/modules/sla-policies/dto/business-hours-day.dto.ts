import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * One entry of the 7-entry `days` array accepted by
 * `CreateBusinessHoursCalendarDto`/`UpdateBusinessHoursCalendarDto`. `weekday`
 * follows JS `Date#getUTCDay()` convention (0=Sunday..6=Saturday) — see the
 * `BusinessHoursDay` model's doc comment in schema.prisma.
 *
 * Cross-field rules (exactly 7 entries, all 7 weekdays present exactly once,
 * `startMinute`/`endMinute` required together only when `isOpen` is true,
 * `startMinute < endMinute`) are business rules, not per-field syntax, so
 * they are checked in `BusinessHoursCalendarsService`, not here — mirroring
 * how this codebase always splits per-field DTO validation from cross-field/
 * cross-record service-layer checks (e.g. `SlaPoliciesService.updateSlaPolicy`'s
 * department-in-scope check).
 */
export class BusinessHoursDayDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: "0=Sunday..6=Saturday" })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty()
  @IsBoolean()
  isOpen!: boolean;

  @ApiProperty({ required: false, minimum: 0, maximum: 1439, description: "Minutes since midnight" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 1439, description: "Minutes since midnight" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinute?: number;
}
