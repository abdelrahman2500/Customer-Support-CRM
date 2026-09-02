import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { KbLocale } from "@prisma/client";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateArticleDto } from "./dto/create-article.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";
import { ListArticlesQueryDto } from "./dto/list-articles-query.dto";
import { LocaleQueryDto } from "./dto/locale-query.dto";
import { SetArticleTranslationDto } from "./dto/set-article-translation.dto";
import type {
  ArticleSummary,
  ArticleTranslationSummary,
  ArticleVersionSummary,
} from "./knowledge-base.service";
import { KnowledgeBaseService } from "./knowledge-base.service";

@ApiTags("knowledge-base")
@ApiBearerAuth()
@Controller("knowledge-base/articles")
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post()
  @RequirePermissions("kb:create")
  create(@Body() dto: CreateArticleDto): Promise<ArticleSummary> {
    return this.knowledgeBaseService.createArticle(dto);
  }

  @Get()
  @RequirePermissions("kb:read")
  list(@Query() query: ListArticlesQueryDto): Promise<ArticleSummary[]> {
    return this.knowledgeBaseService.listArticles(query.search, query.locale);
  }

  @Get(":id")
  @RequirePermissions("kb:read")
  getOne(
    @Param("id") id: string,
    @Query() query: LocaleQueryDto,
  ): Promise<ArticleSummary> {
    return this.knowledgeBaseService.getArticle(id, query.locale);
  }

  @Patch(":id")
  @RequirePermissions("kb:update")
  update(@Param("id") id: string, @Body() dto: UpdateArticleDto): Promise<{ id: string }> {
    return this.knowledgeBaseService.updateArticle(id, dto);
  }

  /** Story 65 — reuses `kb:read` (no new permission, plan Design item 4). */
  @Get(":id/versions")
  @RequirePermissions("kb:read")
  listVersions(@Param("id") id: string): Promise<ArticleVersionSummary[]> {
    return this.knowledgeBaseService.listArticleVersions(id);
  }

  /** Story 109 — reuses `kb:update`/`kb:read` (no new permission, mirrors
   * Story 65's own precedent above). `ParseEnumPipe` rejects an invalid
   * `:locale` segment with a `400` before the handler ever runs. */
  @Put(":id/translations/:locale")
  @RequirePermissions("kb:update")
  setTranslation(
    @Param("id") id: string,
    @Param("locale", new ParseEnumPipe(KbLocale)) locale: KbLocale,
    @Body() dto: SetArticleTranslationDto,
  ): Promise<ArticleTranslationSummary> {
    return this.knowledgeBaseService.setArticleTranslation(id, locale, dto);
  }

  @Get(":id/translations")
  @RequirePermissions("kb:read")
  listTranslations(@Param("id") id: string): Promise<ArticleTranslationSummary[]> {
    return this.knowledgeBaseService.listArticleTranslations(id);
  }
}
