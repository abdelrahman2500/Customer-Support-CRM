import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

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
}
