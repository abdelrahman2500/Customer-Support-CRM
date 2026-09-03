import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { IsPasswordComplex } from "../../../common/validators/is-password-complex.validator";

/** Mirrors `apps/api/src/modules/identity/dto/reset-password.dto.ts`'s `ResetPasswordDto` exactly. */
export class SetContactPortalPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @IsPasswordComplex()
  newPassword!: string;
}
