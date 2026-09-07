import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateKbCategoryDto } from "./dto/create-kb-category.dto";
import type { UpdateKbCategoryDto } from "./dto/update-kb-category.dto";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

export interface KbCategorySummary {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}

/**
 * RM-27 — the managed vocabulary `KnowledgeBaseArticle.categoryId`
 * references. Branch-scoped, mirrors `TicketCategoriesService` field-for
 * -field, including that model's own precedent of no delete route — only
 * rename + activate/deactivate (see `KnowledgeBaseCategory`'s own schema
 * doc comment for why that fully answers the "does category deletion need
 * protection" question).
 */
@Injectable()
export class KbCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async listKbCategories(includeInactive = false): Promise<KbCategorySummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const categories = await this.prisma.knowledgeBaseCategory.findMany({
      where: { branchId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    });
    return categories.map(toKbCategorySummary);
  }

  async createKbCategory(dto: CreateKbCategoryDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    try {
      const category = await this.prisma.knowledgeBaseCategory.create({
        data: { branchId, name: dto.name },
      });
      return { id: category.id };
    } catch (error) {
      throw translateDuplicateCategoryName(error);
    }
  }

  async updateKbCategory(id: string, dto: UpdateKbCategoryDto): Promise<{ id: string }> {
    await this.requireCategoryInScope(id);

    try {
      await this.prisma.knowledgeBaseCategory.update({
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
    const category = await this.prisma.knowledgeBaseCategory.findFirst({ where: { id, branchId } });
    if (!category) {
      throw new NotFoundException("Knowledge Base category not found");
    }
  }
}

function toKbCategorySummary(category: {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}): KbCategorySummary {
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
    return new ConflictException("A Knowledge Base category with this name already exists");
  }
  return error as Error;
}
