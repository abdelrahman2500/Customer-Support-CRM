import { Controller, Get, Param, Query, Req, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { JwtAccessTokenClaims } from "@crm/shared";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import { ListArticlesQueryDto } from "../knowledge-base/dto/list-articles-query.dto";
import { KnowledgeBaseService } from "../knowledge-base/knowledge-base.service";
import type { ArticleSummary } from "../knowledge-base/knowledge-base.service";

/**
 * Story 54 — Customer Portal — Knowledge Base Browsing. Both routes are
 * `@PortalRoute()` (rejects an `agent`-audience token with 401, exactly
 * like `PortalTicketsController`). Scope is the caller's own branch, read
 * directly off the JWT's existing `branchId` claim — already the Contact's
 * Customer's branch (stamped at login by `PortalService.issueAccessToken`,
 * Story 52) — no extra contact lookup needed, unlike
 * `PortalTicketsController`'s `customerId` resolution.
 */
@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal/knowledge-base/articles")
export class PortalKnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @PortalRoute()
  @Get()
  list(
    @Req() request: Request,
    @Query() query: ListArticlesQueryDto,
  ): Promise<ArticleSummary[]> {
    return this.knowledgeBaseService.listPublishedArticlesForBranch(
      this.requireBranchId(request),
      query.search,
    );
  }

  @PortalRoute()
  @Get(":id")
  getOne(@Req() request: Request, @Param("id") id: string): Promise<ArticleSummary> {
    return this.knowledgeBaseService.getPublishedArticleForBranch(
      id,
      this.requireBranchId(request),
    );
  }

  /** A portal-issued token always carries `branchId` (the Contact's
   * Customer's branch, stamped at login — Story 52). This only guards the
   * invariant, mirroring `TenantContext.requireBranchScope`'s own
   * plain-exception-on-violation convention. */
  private requireBranchId(request: Request): string {
    const claims = request.user as JwtAccessTokenClaims;
    if (!claims.branchId) {
      throw new UnauthorizedException("Token has no associated branch");
    }
    return claims.branchId;
  }
}
