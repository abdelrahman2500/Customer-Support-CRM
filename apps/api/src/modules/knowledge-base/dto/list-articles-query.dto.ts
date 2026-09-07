import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { KbLocale, KnowledgeBaseArticleStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/pagination/pagination-query.dto";

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
 *
 * Story S-8c — `page`/`pageSize` arrive by extending `PaginationQueryDto`.
 * This one DTO serves both the agent endpoint and the portal one
 * (`PortalKnowledgeBaseController` imports it), so both gain paging from a
 * single declaration and cannot drift apart on bounds or defaults.
 *
 * RM-05 — `status`, additive and optional like every filter above: the
 * agent-facing `listArticles` path (`GET /knowledge-base/articles`) reads
 * it and narrows accordingly; `listPublishedArticlesForBranch` (the portal
 * path) never reads this field at all — it already hardcodes
 * `status: PUBLISHED` unconditionally, so a portal caller passing this
 * param has no effect and cannot use it to request drafts. Exists so the
 * ticket workspace's Knowledge Base reference search
 * (`TicketKbReferencesController`) can ask for `PUBLISHED` articles only,
 * instead of the unfiltered draft-and-published mix `listArticles` always
 * returned before this — an agent should not be offered a draft to
 * reference (the same article status `TicketKbReferencesService`
 * separately re-validates server-side before actually attaching it).
 *
 * RM-27 — `categoryId`, additive and optional like every filter above: the
 * agent-facing `listArticles` path reads it and narrows accordingly, exact
 * -id equality, mirroring `ListTicketsQueryDto.categoryId`'s own schema
 * change from a free-text `category` filter.
 */
export class ListArticlesQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: KbLocale })
  @IsOptional()
  @IsEnum(KbLocale)
  locale?: KbLocale;

  @ApiProperty({ required: false, enum: KnowledgeBaseArticleStatus })
  @IsOptional()
  @IsEnum(KnowledgeBaseArticleStatus)
  status?: KnowledgeBaseArticleStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
