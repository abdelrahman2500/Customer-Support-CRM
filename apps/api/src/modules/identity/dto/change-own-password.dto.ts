import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { IsPasswordComplex } from "../../../common/validators/is-password-complex.validator";

/**
 * Story 147 — the caller changing their OWN password.
 *
 * Distinct from `ResetPasswordDto` (an admin setting someone else's) by
 * exactly one field: `currentPassword`. That field is what makes this safe
 * without the `user:reset-password` permission — possession of the current
 * password is the authorisation, so a stolen access token alone cannot
 * change the credential it was issued against.
 *
 * `currentPassword` carries no complexity rule on purpose: it is checked
 * against the stored hash, not validated as a new secret, and applying
 * today's policy to it would lock out anyone whose existing password
 * predates that policy.
 */
export class ChangeOwnPasswordDto {
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
