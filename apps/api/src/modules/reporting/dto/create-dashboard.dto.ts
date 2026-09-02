import { ApiProperty } from "@nestjs/swagger";
import { ReportWidgetType } from "@prisma/client";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * Story 110 — `widgetTypes`' order IS the saved `position` (index 0 is
 * position 0, and so on) — no separate `position` field on the wire. A
 * duplicate entry is rejected here (`@ArrayUnique`), with a clearer
 * validation-layer message than letting it fall through to the DB's
 * `@@unique([dashboardId, widgetType])` constraint instead.
 */
export class CreateDashboardDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiProperty({ enum: ReportWidgetType, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(ReportWidgetType, { each: true })
  widgetTypes!: ReportWidgetType[];
}
