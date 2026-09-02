import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

/**
 * Story 119 — `PATCH auth/locale`. The two values are
 * `apps/web/src/i18n/routing.ts`'s own configured locales — never a
 * third value. Mirrored (not imported) by `PortalService`'s own
 * `UpdateLocaleDto`: this codebase's established convention for the
 * Contact/portal side of an identical-shaped concern is a separate,
 * field-for-field-mirrored copy (see `PortalService`'s own doc comment,
 * "mirrors `IdentityService`... field-for-field"), not a shared DTO
 * across module boundaries for a two-field type.
 */
export class UpdateLocaleDto {
  @ApiProperty({ enum: ["en", "ar"] })
  @IsIn(["en", "ar"])
  locale!: "en" | "ar";
}
