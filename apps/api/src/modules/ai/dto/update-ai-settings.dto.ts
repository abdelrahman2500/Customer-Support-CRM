import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

/** Mirrors `UpdateBrandingDto`'s shape exactly — every field optional,
 * so a `PATCH` only ever touches the fields it explicitly sends. */
export class UpdateAiSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  summarizeEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  suggestReplyEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  categorizeEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;
}
