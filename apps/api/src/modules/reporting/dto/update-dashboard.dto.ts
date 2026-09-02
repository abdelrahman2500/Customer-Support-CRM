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
 * Story 110 — mirrors `CreateDashboardDto` exactly, all fields optional
 * (`UpdateQuickReplyDto`'s convention). `widgetTypes`, when given, fully
 * replaces the dashboard's widget list (order = new `position`) — the
 * same all-or-nothing shape `CreateDashboardDto` uses, not a
 * add/remove/reorder-in-place API.
 */
export class UpdateDashboardDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiProperty({ required: false, enum: ReportWidgetType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(ReportWidgetType, { each: true })
  widgetTypes?: ReportWidgetType[];
}
