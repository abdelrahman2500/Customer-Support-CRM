import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

/** Story 109 — mirrors `CreateArticleDto`'s own validation level exactly
 * (`title`/`body` both required, non-empty). `locale` is not a field here
 * — it comes from the route param (`PUT .../translations/:locale`), never
 * the body, mirroring how `branchId`/`articleId` are always resolved from
 * trusted context elsewhere in this codebase, never accepted twice. */
export class SetArticleTranslationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;
}
