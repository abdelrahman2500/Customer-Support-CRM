import { Injectable, NotFoundException } from "@nestjs/common";
import type { AutomationActionAssignmentMode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import type { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";

/** RM-23 — closes the remainder of the unbounded-list tech debt Story 106
 * deliberately left untouched. A fixed `take` cap, not real `paginate()`
 * pagination: this is admin-authored configuration (bounded by how many
 * distinct workflows a branch actually defines), not high-volume
 * operational data — see `identity.service.ts`'s own `MAX_USERS_ROWS` doc
 * comment for the full reasoning, shared verbatim across RM-23's five
 * capped lists. `200` mirrors the KB/Notifications precedent's own value. */
const MAX_AUTOMATION_RULE_ROWS = 200;

export interface AutomationRuleSummary {
  id: string;
  name: string;
  isActive: boolean;
  conditionCategoryId: string | null;
  actionAssignToUserId: string;
  actionSetCategoryId: string | null;
  actionSetDepartmentId: string | null;
  /** RM-24 */
  actionAssignmentMode: AutomationActionAssignmentMode;
  eligibleAgentPool: string[];
  /** RM-29 — plain string, not `TicketPriority` — see
   * `AutomationRule.actionSetPriority`'s own schema doc comment. */
  actionSetPriority: string | null;
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
 *
 * RM-29 — `actionSetPriority` added alongside `actionSetCategoryId`/
 * `actionSetDepartmentId`. No `requireXInScope` validation needed (unlike
 * those two): it's a plain enum value, not a relation — `@IsEnum` at the
 * DTO layer is already authoritative.
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
    if (dto.conditionCategoryId !== undefined) {
      await this.requireCategoryInScope(dto.conditionCategoryId, branchId);
    }
    if (dto.actionSetCategoryId !== undefined) {
      await this.requireCategoryInScope(dto.actionSetCategoryId, branchId);
    }
    // RM-24 — every pool member is validated exactly like
    // `actionAssignToUserId` already is; a rule's pool can never name a
    // user outside this branch.
    if (dto.eligibleAgentPool !== undefined) {
      await Promise.all(
        dto.eligibleAgentPool.map((userId) => this.requireUserInScope(userId, branchId)),
      );
    }

    const rule = await this.prisma.automationRule.create({
      data: {
        branchId,
        name: dto.name,
        conditionCategoryId: dto.conditionCategoryId ?? null,
        actionAssignToUserId: dto.actionAssignToUserId,
        actionSetCategoryId: dto.actionSetCategoryId ?? null,
        actionSetDepartmentId: dto.actionSetDepartmentId ?? null,
        actionSetPriority: dto.actionSetPriority ?? null,
        ...(dto.actionAssignmentMode !== undefined
          ? { actionAssignmentMode: dto.actionAssignmentMode }
          : {}),
        ...(dto.eligibleAgentPool !== undefined ? { eligibleAgentPool: dto.eligibleAgentPool } : {}),
      },
    });
    return toAutomationRuleSummary(rule);
  }

  async listAutomationRules(): Promise<AutomationRuleSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const rules = await this.prisma.automationRule.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
      take: MAX_AUTOMATION_RULE_ROWS,
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
    if (dto.conditionCategoryId !== undefined && dto.conditionCategoryId !== null) {
      await this.requireCategoryInScope(dto.conditionCategoryId, branchId);
    }
    if (dto.actionSetCategoryId !== undefined && dto.actionSetCategoryId !== null) {
      await this.requireCategoryInScope(dto.actionSetCategoryId, branchId);
    }
    if (dto.eligibleAgentPool !== undefined) {
      await Promise.all(
        dto.eligibleAgentPool.map((userId) => this.requireUserInScope(userId, branchId)),
      );
    }

    await this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.conditionCategoryId !== undefined
          ? { conditionCategoryId: dto.conditionCategoryId }
          : {}),
        ...(dto.actionAssignToUserId !== undefined
          ? { actionAssignToUserId: dto.actionAssignToUserId }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.actionSetCategoryId !== undefined
          ? { actionSetCategoryId: dto.actionSetCategoryId }
          : {}),
        ...(dto.actionSetDepartmentId !== undefined
          ? { actionSetDepartmentId: dto.actionSetDepartmentId }
          : {}),
        ...(dto.actionSetPriority !== undefined ? { actionSetPriority: dto.actionSetPriority } : {}),
        ...(dto.actionAssignmentMode !== undefined
          ? { actionAssignmentMode: dto.actionAssignmentMode }
          : {}),
        ...(dto.eligibleAgentPool !== undefined ? { eligibleAgentPool: dto.eligibleAgentPool } : {}),
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
    conditionCategoryId: string | null;
    actionAssignToUserId: string;
    actionSetCategoryId: string | null;
    actionSetDepartmentId: string | null;
    actionSetPriority: string | null;
    actionAssignmentMode: AutomationActionAssignmentMode;
    eligibleAgentPool: string[];
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

  /** Story 120 — mirrors `requireDepartmentInScope`'s exact shape, shared
   * by both `conditionCategoryId` and `actionSetCategoryId`. */
  private async requireCategoryInScope(categoryId: string, branchId: string): Promise<void> {
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id: categoryId, branchId },
    });
    if (!category) {
      throw new NotFoundException("Ticket category not found in this branch");
    }
  }
}

function toAutomationRuleSummary(rule: {
  id: string;
  name: string;
  isActive: boolean;
  conditionCategoryId: string | null;
  actionAssignToUserId: string;
  actionSetCategoryId: string | null;
  actionSetDepartmentId: string | null;
  actionSetPriority: string | null;
  actionAssignmentMode: AutomationActionAssignmentMode;
  eligibleAgentPool: string[];
}): AutomationRuleSummary {
  return {
    id: rule.id,
    name: rule.name,
    isActive: rule.isActive,
    conditionCategoryId: rule.conditionCategoryId,
    actionAssignToUserId: rule.actionAssignToUserId,
    actionSetCategoryId: rule.actionSetCategoryId,
    actionSetDepartmentId: rule.actionSetDepartmentId,
    actionSetPriority: rule.actionSetPriority,
    actionAssignmentMode: rule.actionAssignmentMode,
    eligibleAgentPool: rule.eligibleAgentPool,
  };
}
