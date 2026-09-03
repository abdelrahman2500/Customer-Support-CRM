import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

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
}
