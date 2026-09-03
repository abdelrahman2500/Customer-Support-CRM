import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { IsPasswordComplex } from "../../../common/validators/is-password-complex.validator";

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @IsPasswordComplex()
  newPassword!: string;
}
