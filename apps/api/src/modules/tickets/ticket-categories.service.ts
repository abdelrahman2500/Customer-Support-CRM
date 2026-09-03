import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateTicketCategoryDto } from "./dto/create-ticket-category.dto";
import type { UpdateTicketCategoryDto } from "./dto/update-ticket-category.dto";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

export interface TicketCategorySummary {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}

/**
 * Story 120 — the managed vocabulary `Ticket.categoryId`,
 * `SlaPolicy.categoryId`, and `AutomationRule.conditionCategoryId`/
 * `actionSetCategoryId` all reference. Branch-scoped, mirrors
 * `IdentityService`'s `createDepartment`/`updateDepartment`/
 * `listDepartments` field-for-field, including that model's own
 * precedent of no delete route — only rename + activate/deactivate (see
 * `TicketCategory`'s own schema doc comment for why that fully answers
 * the "does category deletion need protection" question).
 */
@Injectable()
export class TicketCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async listTicketCategories(includeInactive = false): Promise<TicketCategorySummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const categories = await this.prisma.ticketCategory.findMany({
      where: { branchId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    });
    return categories.map(toTicketCategorySummary);
  }

  async createTicketCategory(dto: CreateTicketCategoryDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    try {
      const category = await this.prisma.ticketCategory.create({
        data: { branchId, name: dto.name },
      });
      return { id: category.id };
    } catch (error) {
      throw translateDuplicateCategoryName(error);
    }
  }

  async updateTicketCategory(id: string, dto: UpdateTicketCategoryDto): Promise<{ id: string }> {
    await this.requireCategoryInScope(id);

    try {
      await this.prisma.ticketCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      return { id };
    } catch (error) {
      throw translateDuplicateCategoryName(error);
    }
  }

  private async requireCategoryInScope(id: string): Promise<void> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const category = await this.prisma.ticketCategory.findFirst({ where: { id, branchId } });
    if (!category) {
      throw new NotFoundException("Ticket category not found");
    }
  }
}

function toTicketCategorySummary(category: {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}): TicketCategorySummary {
  return {
    id: category.id,
    branchId: category.branchId,
    name: category.name,
    isActive: category.isActive,
  };
}

function translateDuplicateCategoryName(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    return new ConflictException("A ticket category with this name already exists");
  }
  return error as Error;
}
