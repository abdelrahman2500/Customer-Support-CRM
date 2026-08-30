import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUrl, Matches } from "class-validator";

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class UpdateBrandingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: "primaryColor must be a #rrggbb hex color" })
  primaryColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: "secondaryColor must be a #rrggbb hex color" })
  secondaryColor?: string;
}
