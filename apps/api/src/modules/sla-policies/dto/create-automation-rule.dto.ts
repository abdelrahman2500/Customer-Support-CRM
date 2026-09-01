import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateAutomationRuleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conditionCategory?: string;

  @ApiProperty()
  @IsUUID()
  actionAssignToUserId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  actionSetCategory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  actionSetDepartmentId?: string;
}
