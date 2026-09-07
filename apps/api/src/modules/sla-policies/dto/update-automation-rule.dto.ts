import { ApiProperty } from "@nestjs/swagger";
import { AutomationActionAssignmentMode } from "@prisma/client";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class UpdateAutomationRuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  conditionCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  actionAssignToUserId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  actionSetCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  actionSetDepartmentId?: string;

  /** RM-24 */
  @ApiProperty({ required: false, enum: AutomationActionAssignmentMode })
  @IsOptional()
  @IsEnum(AutomationActionAssignmentMode)
  actionAssignmentMode?: AutomationActionAssignmentMode;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  eligibleAgentPool?: string[];
}
