import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import type { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";

export interface AutomationRuleSummary {
  id: string;
  name: string;
  isActive: boolean;
  conditionCategory: string | null;
  actionAssignToUserId: string;
  actionSetCategory: string | null;
  actionSetDepartmentId: string | null;
}

/**
 * Story 57 — grows `SlaPoliciesModule` (the `sla`-schema owner) the same
 * way `SlaTargetsService`/`SlaEscalationsService`/`BusinessHoursCalendarsService`
 * each already did — mirrors `SlaPoliciesService`'s exact CRUD shape
 * (`findXInScope` 404-masking, `TenantContext.requireBranchScope()`).
 *
 * Never itself reacts to or evaluates against a real `Ticket` —
 * `AutomationEvaluationListener` (this same module) owns that; this
 * service is pure CRUD.
 */
@Injectable()
export class AutomationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createAutomationRule(dto: CreateAutomationRuleDto): Promise<AutomationRuleSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    await this.requireUserInScope(dto.actionAssignToUserId, branchId);
    if (dto.actionSetDepartmentId !== undefined) {
      await this.requireDepartmentInScope(dto.actionSetDepartmentId, branchId);
    }

    const rule = await this.prisma.automationRule.create({
      data: {
        branchId,
        name: dto.name,
        conditionCategory: dto.conditionCategory ?? null,
        actionAssignToUserId: dto.actionAssignToUserId,
        actionSetCategory: dto.actionSetCategory ?? null,
        actionSetDepartmentId: dto.actionSetDepartmentId ?? null,
      },
    });
    return toAutomationRuleSummary(rule);
  }

  async listAutomationRules(): Promise<AutomationRuleSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const rules = await this.prisma.automationRule.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
    return rules.map(toAutomationRuleSummary);
  }

  async getAutomationRule(id: string): Promise<AutomationRuleSummary> {
    const rule = await this.findAutomationRuleInScope(id);
    return toAutomationRuleSummary(rule);
  }

  async updateAutomationRule(id: string, dto: UpdateAutomationRuleDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    await this.findAutomationRuleInScope(id);

    if (dto.actionAssignToUserId !== undefined) {
      await this.requireUserInScope(dto.actionAssignToUserId, branchId);
    }
    if (dto.actionSetDepartmentId !== undefined) {
      await this.requireDepartmentInScope(dto.actionSetDepartmentId, branchId);
    }

    await this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.conditionCategory !== undefined ? { conditionCategory: dto.conditionCategory } : {}),
        ...(dto.actionAssignToUserId !== undefined
          ? { actionAssignToUserId: dto.actionAssignToUserId }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.actionSetCategory !== undefined ? { actionSetCategory: dto.actionSetCategory } : {}),
        ...(dto.actionSetDepartmentId !== undefined
          ? { actionSetDepartmentId: dto.actionSetDepartmentId }
          : {}),
      },
    });
    return { id };
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findAutomationRuleInScope(id: string): Promise<{
    id: string;
    name: string;
    isActive: boolean;
    conditionCategory: string | null;
    actionAssignToUserId: string;
    actionSetCategory: string | null;
    actionSetDepartmentId: string | null;
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const rule = await this.prisma.automationRule.findFirst({ where: { id, branchId } });
    if (!rule) {
      throw new NotFoundException("Automation rule not found");
    }
    return rule;
  }

  private async requireUserInScope(userId: string, branchId: string): Promise<void> {
    const membership = await this.prisma.userBranchRole.findFirst({
      where: { userId, branchId },
    });
    if (!membership) {
      throw new NotFoundException("User not found in this branch");
    }
  }

  /** Story 83 — mirrors `requireUserInScope`'s exact shape: validated
   * once, here, at create/update time; never re-validated at
   * automation-match time (`AutomationActionListener` trusts the stored
   * value, mirroring `actionAssignToUserId`'s own convention). */
  private async requireDepartmentInScope(departmentId: string, branchId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, branchId },
    });
    if (!department) {
      throw new NotFoundException("Department not found in this branch");
    }
  }
}

function toAutomationRuleSummary(rule: {
  id: string;
  name: string;
  isActive: boolean;
  conditionCategory: string | null;
  actionAssignToUserId: string;
  actionSetCategory: string | null;
  actionSetDepartmentId: string | null;
}): AutomationRuleSummary {
  return {
    id: rule.id,
    name: rule.name,
    isActive: rule.isActive,
    conditionCategory: rule.conditionCategory,
    actionAssignToUserId: rule.actionAssignToUserId,
    actionSetCategory: rule.actionSetCategory,
    actionSetDepartmentId: rule.actionSetDepartmentId,
  };
}
