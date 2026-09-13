import { ApiProperty } from "@nestjs/swagger";
import { NavigationLayout } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUrl, Matches, MaxLength } from "class-validator";

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class UpdateBrandingDto {
  /**
   * Story 129 — the branch's own application name, replacing the
   * hard-coded `workspace.appName` i18n string wherever the app prints
   * its own name.
   *
   * No `@Matches` pattern: a brand name is free text in both locales,
   * including Arabic, so there is no meaningful character class to
   * enforce. `@MaxLength(60)` is deliberate, though — the name renders
   * inside a fixed-width sidebar rail and a single-line navbar, and
   * without a cap an admin can paste a paragraph and break both.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  appName?: string;

  /** Story 129 — `SIDEBAR` or `NAVBAR`. Anything else (a lowercase
   * `"sidebar"`, a `"TOPBAR"`) is rejected 400 here, before it ever
   * reaches the service. */
  @ApiProperty({ required: false, enum: NavigationLayout })
  @IsOptional()
  @IsEnum(NavigationLayout)
  navigationLayout?: NavigationLayout;

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
