import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateSlaPolicyDto } from "./dto/create-sla-policy.dto";
import type { UpdateSlaPolicyDto } from "./dto/update-sla-policy.dto";

export interface SlaPolicySummary {
  id: string;
  departmentId: string | null;
  categoryId: string | null;
  priority: string | null;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  isActive: boolean;
}

/**
 * Owns the `sla` schema — see docs/architecture/03-domain-boundaries.md
 * ("SLA & Automation"). `SlaPolicy` is a branch-scoped aggregate root, the
 * same shape as `Customer`/`Ticket` — never a sub-entity. This service does
 * not react to any Ticketing event and is not reacted to by anything; it
 * only stores policies for a future story to consume.
 */
@Injectable()
export class SlaPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createSlaPolicy(dto: CreateSlaPolicyDto): Promise<SlaPolicySummary> {
    const { branchId } = this.tenantContext.requireBranchScope();

    this.assertTargetOrdering(dto.responseTargetMinutes, dto.resolutionTargetMinutes);

    if (dto.departmentId) {
      await this.requireDepartmentInScope(dto.departmentId, branchId);
    }
    if (dto.categoryId) {
      await this.requireCategoryInScope(dto.categoryId, branchId);
    }

    const policy = await this.prisma.slaPolicy.create({
      data: {
        branchId,
        departmentId: dto.departmentId ?? null,
        categoryId: dto.categoryId ?? null,
        priority: dto.priority ?? null,
        responseTargetMinutes: dto.responseTargetMinutes,
        resolutionTargetMinutes: dto.resolutionTargetMinutes,
      },
    });
    return toSlaPolicySummary(policy);
  }

  async listSlaPolicies(): Promise<SlaPolicySummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const policies = await this.prisma.slaPolicy.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
    return policies.map(toSlaPolicySummary);
  }

  async getSlaPolicy(id: string): Promise<SlaPolicySummary> {
    const policy = await this.findSlaPolicyInScope(id);
    return toSlaPolicySummary(policy);
  }

  async updateSlaPolicy(id: string, dto: UpdateSlaPolicyDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const existing = await this.findSlaPolicyInScope(id);

    // Story S-9 — checked against the MERGED values, which is why this rule
    // lives here rather than on the DTO. This DTO is partial: a request may
    // send only `resolutionTargetMinutes`, and whether that inverts the pair
    // depends on the `responseTargetMinutes` already stored. A class-validator
    // rule cannot see the row, so it could only catch the both-fields-present
    // case and would silently pass the one-field case that matters most.
    this.assertTargetOrdering(
      dto.responseTargetMinutes ?? existing.responseTargetMinutes,
      dto.resolutionTargetMinutes ?? existing.resolutionTargetMinutes,
    );

    if (dto.departmentId !== undefined) {
      await this.requireDepartmentInScope(dto.departmentId, branchId);
    }
    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      await this.requireCategoryInScope(dto.categoryId, branchId);
    }

    await this.prisma.slaPolicy.update({
      where: { id },
      data: {
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.responseTargetMinutes !== undefined
          ? { responseTargetMinutes: dto.responseTargetMinutes }
          : {}),
        ...(dto.resolutionTargetMinutes !== undefined
          ? { resolutionTargetMinutes: dto.resolutionTargetMinutes }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return { id };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  /**
   * Story S-9 — a policy may not resolve before it responds.
   *
   * Previously nothing enforced this at any layer: both fields were only
   * `@IsInt() @Min(1)`, there is no DB check constraint, and
   * `SlaTargetListener.computeTargetTimestamps` applies
   * `addBusinessMinutes` to each independently from the same start, so
   * inverted minutes produce `resolutionTargetAt < responseTargetAt`.
   *
   * That mattered beyond being nonsense to configure. The agent-facing SLA
   * status takes the EARLIER of the two targets as the governing one (see
   * `apps/web/src/lib/sla.ts`'s `deriveSlaStatus`), so with the pair
   * inverted, "urgency" is governed by the resolution target while
   * `GET /tickets?sortBy=slaUrgency` orders by the response target — the
   * list order would silently contradict the badge on its own rows.
   * Forbidding the inversion is what makes ordering by `responseTargetAt`
   * alone provably equal to ordering by `LEAST(response, resolution)`,
   * and so lets that sort be a plain indexed column rather than a
   * computed expression.
   *
   * Equal values are allowed: "respond and resolve within the same 30
   * minutes" is a coherent policy, and it leaves the two targets tied
   * rather than inverted.
   */
  private assertTargetOrdering(responseMinutes: number, resolutionMinutes: number): void {
    if (resolutionMinutes < responseMinutes) {
      throw new BadRequestException(
        "resolutionTargetMinutes must be greater than or equal to responseTargetMinutes",
      );
    }
  }

  private async findSlaPolicyInScope(id: string): Promise<{
    id: string;
    departmentId: string | null;
    categoryId: string | null;
    priority: string | null;
    responseTargetMinutes: number;
    resolutionTargetMinutes: number;
    isActive: boolean;
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const policy = await this.prisma.slaPolicy.findFirst({ where: { id, branchId } });
    if (!policy) {
      throw new NotFoundException("SLA policy not found");
    }
    return policy;
  }

  private async requireDepartmentInScope(departmentId: string, branchId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, branchId },
    });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
  }

  /** Story 120 — mirrors `requireDepartmentInScope`'s exact shape. */
  private async requireCategoryInScope(categoryId: string, branchId: string): Promise<void> {
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id: categoryId, branchId },
    });
    if (!category) {
      throw new NotFoundException("Ticket category not found");
    }
  }
}

function toSlaPolicySummary(policy: {
  id: string;
  departmentId: string | null;
  categoryId: string | null;
  priority: string | null;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  isActive: boolean;
}): SlaPolicySummary {
  return {
    id: policy.id,
    departmentId: policy.departmentId,
    categoryId: policy.categoryId,
    priority: policy.priority,
    responseTargetMinutes: policy.responseTargetMinutes,
    resolutionTargetMinutes: policy.resolutionTargetMinutes,
    isActive: policy.isActive,
  };
}
