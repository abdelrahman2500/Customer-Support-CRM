import { ApiProperty } from "@nestjs/swagger";
import { AutomationActionAssignmentMode, TicketPriority } from "@prisma/client";
import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateAutomationRuleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  conditionCategoryId?: string;

  @ApiProperty()
  @IsUUID()
  actionAssignToUserId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  actionSetCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  actionSetDepartmentId?: string;

  /** RM-29 — applied only when the ticket's creator never explicitly chose
   * a priority (see `AutomationRule.actionSetPriority`'s own schema doc
   * comment for why this can't reuse the `null`-sentinel guard
   * `actionSetCategoryId`/`actionSetDepartmentId` use). */
  @ApiProperty({ required: false, enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  actionSetPriority?: TicketPriority;

  /** RM-24 — omitted defaults to `FIXED` (Prisma's own column default). */
  @ApiProperty({ required: false, enum: AutomationActionAssignmentMode })
  @IsOptional()
  @IsEnum(AutomationActionAssignmentMode)
  actionAssignmentMode?: AutomationActionAssignmentMode;

  /** RM-24 — only meaningful when `actionAssignmentMode` is
   * `LEAST_LOADED`; omitted defaults to `[]` (`actionAssignToUserId` is
   * then this rule's only possible assignee, mirroring `FIXED`). */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  eligibleAgentPool?: string[];
}
