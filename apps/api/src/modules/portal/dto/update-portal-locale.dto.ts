import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

/** Story 119 — `PATCH portal/auth/locale`. Mirrors
 * `IdentityService`'s own `UpdateLocaleDto` field-for-field — see that
 * file's own doc comment for why this is a separate copy, not a shared
 * DTO. */
export class UpdatePortalLocaleDto {
  @ApiProperty({ enum: ["en", "ar"] })
  @IsIn(["en", "ar"])
  locale!: "en" | "ar";
}
