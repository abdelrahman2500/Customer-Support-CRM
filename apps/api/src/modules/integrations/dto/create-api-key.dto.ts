import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { API_KEY_SCOPES } from "../api-key-scopes";

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty({ enum: API_KEY_SCOPES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes!: string[];

  @ApiProperty({ required: false, description: "ISO 8601 — omit for a key that never expires." })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
