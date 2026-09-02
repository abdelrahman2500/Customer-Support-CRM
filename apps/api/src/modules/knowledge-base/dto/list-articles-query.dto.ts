import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { KbLocale } from "@prisma/client";

/**
 * Story 64 — the first search-query-param precedent anywhere in this
 * codebase (`ListTicketsQueryDto`'s own doc comment explicitly deferred
 * search as out of scope for Story 23). Matches `title`/`body` via a plain
 * `contains`/`mode: "insensitive"` filter, not `tsvector` — see
 * `knowledge-base.service.ts`'s own doc comment for why.
 *
 * Story 109 — `locale`, when given and a matching
 * `KnowledgeBaseArticleTranslation` row exists, resolves the returned
 * `title`/`body` to that translation instead of the base article's own —
 * see `KnowledgeBaseService`'s own locale-resolution doc comment.
 * Deliberately does not affect `search` (Story 102's full-text search
 * stays English-only against the base `search_vector` column — see this
 * story's own plan doc, "Non-goals").
 */
export class ListArticlesQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: KbLocale })
  @IsOptional()
  @IsEnum(KbLocale)
  locale?: KbLocale;
}
