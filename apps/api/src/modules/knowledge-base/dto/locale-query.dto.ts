import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { KbLocale } from "@prisma/client";

/** Story 109 — the single-article counterpart to `ListArticlesQueryDto`'s
 * `locale` field, kept as its own small DTO (rather than reusing
 * `ListArticlesQueryDto` wholesale) so a single-article `GET` never also
 * accepts a meaningless `search` field. */
export class LocaleQueryDto {
  @ApiProperty({ required: false, enum: KbLocale })
  @IsOptional()
  @IsEnum(KbLocale)
  locale?: KbLocale;
}
