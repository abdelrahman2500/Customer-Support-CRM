import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { UpdateAiSettingsDto } from "./dto/update-ai-settings.dto";

export interface AiSettingsSummary {
  summarizeEnabled: boolean;
  suggestReplyEnabled: boolean;
  categorizeEnabled: boolean;
  chatEnabled: boolean;
  /** RM-00 — Suggested Solutions per-branch flag, mirroring the other
   * three ticket-scoped flags exactly. */
  suggestSolutionsEnabled: boolean;
}

/** The pre-Story-81 behavior for every branch: every feature enabled.
 * Returned whenever a branch has no `AiSettings` row yet — mirrors
 * `BrandingService`'s own `DEFAULT_BRANDING` "absence means default"
 * convention exactly. */
const DEFAULT_AI_SETTINGS: AiSettingsSummary = {
  summarizeEnabled: true,
  suggestReplyEnabled: true,
  categorizeEnabled: true,
  chatEnabled: true,
  suggestSolutionsEnabled: true,
};

/**
 * Story 81 — closes Story 72's own disclosed non-goal ("No per-branch
 * admin UI for enabling/disabling AI features") and fulfills
 * docs/architecture/07-sla-automation-and-ai.md's "Features are
 * flaggable per branch." Mirrors `BrandingService`'s exact shape
 * (`GET` never 404s, `PATCH` is upsert) — see that service's own doc
 * comment for the shared rationale.
 */
@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getSettings(): Promise<AiSettingsSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const settings = await this.prisma.aiSettings.findUnique({ where: { branchId } });
    return settings ? toSummary(settings) : DEFAULT_AI_SETTINGS;
  }

  async updateSettings(dto: UpdateAiSettingsDto): Promise<AiSettingsSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const settings = await this.prisma.aiSettings.upsert({
      where: { branchId },
      create: {
        branchId,
        summarizeEnabled: dto.summarizeEnabled ?? true,
        suggestReplyEnabled: dto.suggestReplyEnabled ?? true,
        categorizeEnabled: dto.categorizeEnabled ?? true,
        chatEnabled: dto.chatEnabled ?? true,
        suggestSolutionsEnabled: dto.suggestSolutionsEnabled ?? true,
      },
      update: {
        ...(dto.summarizeEnabled !== undefined ? { summarizeEnabled: dto.summarizeEnabled } : {}),
        ...(dto.suggestReplyEnabled !== undefined
          ? { suggestReplyEnabled: dto.suggestReplyEnabled }
          : {}),
        ...(dto.categorizeEnabled !== undefined ? { categorizeEnabled: dto.categorizeEnabled } : {}),
        ...(dto.chatEnabled !== undefined ? { chatEnabled: dto.chatEnabled } : {}),
        ...(dto.suggestSolutionsEnabled !== undefined
          ? { suggestSolutionsEnabled: dto.suggestSolutionsEnabled }
          : {}),
      },
    });
    return toSummary(settings);
  }

  /** Consulted by `TicketAiService`/`AiChatService` before enqueueing.
   * Branch-scoped by an already-authorized caller's own `branchId` —
   * never re-derives tenant scope itself, mirroring every other
   * cross-service call in this codebase. Absence of a row (the common
   * case) means every feature is enabled. */
  async isFeatureEnabled(
    branchId: string,
    feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE" | "CHAT" | "SUGGEST_SOLUTIONS",
  ): Promise<boolean> {
    const settings = await this.prisma.aiSettings.findUnique({ where: { branchId } });
    if (!settings) {
      return true;
    }
    switch (feature) {
      case "SUMMARIZE":
        return settings.summarizeEnabled;
      case "SUGGEST_REPLY":
        return settings.suggestReplyEnabled;
      case "CATEGORIZE":
        return settings.categorizeEnabled;
      case "CHAT":
        return settings.chatEnabled;
      case "SUGGEST_SOLUTIONS":
        return settings.suggestSolutionsEnabled;
    }
  }
}

function toSummary(settings: {
  summarizeEnabled: boolean;
  suggestReplyEnabled: boolean;
  categorizeEnabled: boolean;
  chatEnabled: boolean;
  suggestSolutionsEnabled: boolean;
}): AiSettingsSummary {
  return {
    summarizeEnabled: settings.summarizeEnabled,
    suggestReplyEnabled: settings.suggestReplyEnabled,
    categorizeEnabled: settings.categorizeEnabled,
    chatEnabled: settings.chatEnabled,
    suggestSolutionsEnabled: settings.suggestSolutionsEnabled,
  };
}
