import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { IsPasswordComplex } from "../../../common/validators/is-password-complex.validator";

/**
 * Story 147 — mirrors `ChangeOwnPasswordDto` field-for-field, for the
 * portal's own audience.
 *
 * Kept as its own DTO rather than imported from the identity module for
 * the same reason `UpdatePortalLocaleDto` is separate from
 * `UpdateLocaleDto`: the portal owns its own request surface, and sharing
 * a DTO across the two audiences would couple them for no gain.
 *
 * `newPassword` carries the same `@MinLength(8)` + `@IsPasswordComplex()`
 * pair that `SetContactPortalPasswordDto` already applies when an agent
 * sets a contact's password, so a customer cannot set themselves a weaker
 * password than an agent could set for them.
 */
export class ChangePortalPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @IsPasswordComplex()
  newPassword!: string;
}
