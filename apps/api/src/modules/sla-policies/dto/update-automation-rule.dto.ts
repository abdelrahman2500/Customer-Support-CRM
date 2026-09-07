import { ApiProperty } from "@nestjs/swagger";
import { AutomationActionAssignmentMode, TicketPriority } from "@prisma/client";
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

  /** RM-29 — mirrors `CreateAutomationRuleDto.actionSetPriority`'s own
   * doc comment. */
  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  actionSetPriority?: TicketPriority;

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
