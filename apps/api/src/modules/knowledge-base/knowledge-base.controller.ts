import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateArticleDto } from "./dto/create-article.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";
import { ListArticlesQueryDto } from "./dto/list-articles-query.dto";
import type { ArticleSummary, ArticleVersionSummary } from "./knowledge-base.service";
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
    return this.knowledgeBaseService.listArticles(query.search);
  }

  @Get(":id")
  @RequirePermissions("kb:read")
  getOne(@Param("id") id: string): Promise<ArticleSummary> {
    return this.knowledgeBaseService.getArticle(id);
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
}
