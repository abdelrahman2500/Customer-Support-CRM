import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateKbCategoryDto } from "./dto/create-kb-category.dto";
import { UpdateKbCategoryDto } from "./dto/update-kb-category.dto";
import type { KbCategorySummary } from "./kb-categories.service";
import { KbCategoriesService } from "./kb-categories.service";

/**
 * RM-27 — branch-scoped managed category vocabulary for the Knowledge
 * Base. Mirrors `TicketCategoriesController` exactly: `:read` reachable by
 * the default Agent role (agents pick a category day to day), `:create`/
 * `:update` SuperAdmin-only. No delete route — see `KbCategoriesService`'s
 * own doc comment.
 */
@ApiTags("kb-categories")
@ApiBearerAuth()
@Controller("kb-categories")
export class KbCategoriesController {
  constructor(private readonly kbCategoriesService: KbCategoriesService) {}

  @Get()
  @RequirePermissions("kb-category:read")
  list(@Query("includeInactive") includeInactive?: string): Promise<KbCategorySummary[]> {
    return this.kbCategoriesService.listKbCategories(includeInactive === "true");
  }

  @Post()
  @RequirePermissions("kb-category:create")
  create(@Body() dto: CreateKbCategoryDto): Promise<{ id: string }> {
    return this.kbCategoriesService.createKbCategory(dto);
  }

  @Patch(":id")
  @RequirePermissions("kb-category:update")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateKbCategoryDto,
  ): Promise<{ id: string }> {
    return this.kbCategoriesService.updateKbCategory(id, dto);
  }
}
