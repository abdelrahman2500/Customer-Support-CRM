import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

/** Mirrors `apps/api/src/modules/identity/dto/login.dto.ts`'s `LoginDto` exactly. */
export class PortalLoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}
