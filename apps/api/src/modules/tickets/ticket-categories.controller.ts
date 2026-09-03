import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import { CreateTicketCategoryDto } from "./dto/create-ticket-category.dto";
import { UpdateTicketCategoryDto } from "./dto/update-ticket-category.dto";
import type { TicketCategorySummary } from "./ticket-categories.service";
import { TicketCategoriesService } from "./ticket-categories.service";

/**
 * Story 120 — branch-scoped managed category vocabulary. Mirrors
 * `IdentityController`'s `departments` routes exactly: `:read` reachable
 * by the default Agent role (agents pick a category day to day),
 * `:create`/`:update` SuperAdmin-only. No delete route — see
 * `TicketCategoriesService`'s own doc comment.
 */
@ApiTags("ticket-categories")
@ApiBearerAuth()
@Controller("ticket-categories")
export class TicketCategoriesController {
  constructor(private readonly ticketCategoriesService: TicketCategoriesService) {}

  @Get()
  @RequirePermissions("ticket-category:read")
  list(@Query("includeInactive") includeInactive?: string): Promise<TicketCategorySummary[]> {
    return this.ticketCategoriesService.listTicketCategories(includeInactive === "true");
  }

  @Post()
  @RequirePermissions("ticket-category:create")
  create(@Body() dto: CreateTicketCategoryDto): Promise<{ id: string }> {
    return this.ticketCategoriesService.createTicketCategory(dto);
  }

  @Patch(":id")
  @RequirePermissions("ticket-category:update")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTicketCategoryDto,
  ): Promise<{ id: string }> {
    return this.ticketCategoriesService.updateTicketCategory(id, dto);
  }
}
