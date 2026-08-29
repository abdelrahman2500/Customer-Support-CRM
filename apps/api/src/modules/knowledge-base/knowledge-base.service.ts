import { Injectable, NotFoundException } from "@nestjs/common";
import type { KnowledgeBaseArticleStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateArticleDto } from "./dto/create-article.dto";
import type { UpdateArticleDto } from "./dto/update-article.dto";

export interface ArticleSummary {
  id: string;
  branchId: string;
  title: string;
  body: string;
  category: string | null;
  status: KnowledgeBaseArticleStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Owns the `knowledge_base` schema — see
 * docs/architecture/03-domain-boundaries.md ("Knowledge Base"). Story 51 —
 * foundation only: `KnowledgeBaseArticle` is a standalone, branch-scoped
 * aggregate root, the same shape as `SlaPolicy`/`Customer`/`Ticket` — never
 * a sub-entity of anything else. No full-text/vector search, no
 * multi-version publish history, no Customer Portal or AI Services
 * consumption — see the plan's Story Goal / Design items 3, 5, 7.
 */
@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createArticle(dto: CreateArticleDto): Promise<ArticleSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const article = await this.prisma.knowledgeBaseArticle.create({
      data: {
        branchId,
        title: dto.title,
        body: dto.body,
        category: dto.category ?? null,
      },
    });
    return toArticleSummary(article);
  }

  async listArticles(): Promise<ArticleSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const articles = await this.prisma.knowledgeBaseArticle.findMany({
      where: { branchId },
      orderBy: { updatedAt: "desc" },
    });
    return articles.map(toArticleSummary);
  }

  async getArticle(id: string): Promise<ArticleSummary> {
    const article = await this.findArticleInScope(id);
    return toArticleSummary(article);
  }

  /**
   * `publishedAt` is set to `now()` whenever `dto.status` is `PUBLISHED`
   * (including a re-publish after an edit) and left untouched otherwise — a
   * plain last-transition timestamp, not a version log (plan Design item 5).
   */
  async updateArticle(id: string, dto: UpdateArticleDto): Promise<{ id: string }> {
    await this.findArticleInScope(id);

    await this.prisma.knowledgeBaseArticle.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
      },
    });
    return { id };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findArticleInScope(id: string): Promise<{
    id: string;
    branchId: string;
    title: string;
    body: string;
    category: string | null;
    status: KnowledgeBaseArticleStatus;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const article = await this.prisma.knowledgeBaseArticle.findFirst({
      where: { id, branchId },
    });
    if (!article) {
      throw new NotFoundException("Article not found");
    }
    return article;
  }
}

function toArticleSummary(article: {
  id: string;
  branchId: string;
  title: string;
  body: string;
  category: string | null;
  status: KnowledgeBaseArticleStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ArticleSummary {
  return {
    id: article.id,
    branchId: article.branchId,
    title: article.title,
    body: article.body,
    category: article.category,
    status: article.status,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}
