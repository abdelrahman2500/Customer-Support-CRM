import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateQuickReplyDto } from "./dto/create-quick-reply.dto";
import type { UpdateQuickReplyDto } from "./dto/update-quick-reply.dto";

export interface QuickReplySummary {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
}

/**
 * Story 91 — grows `ChannelsModule` with its first controller-facing
 * resource. Owns `channels.quick_replies` — see docs/architecture/03-
 * domain-boundaries.md ("Communication / Channels", "quick replies").
 * Mirrors `NotificationTemplatesService`'s exact shape (branch-admin
 * resource, no cross-entity validation) rather than
 * `AutomationRulesService`'s (which validates foreign-key fields against
 * the branch) — a quick reply has no foreign-key fields to validate.
 */
@Injectable()
export class QuickRepliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createQuickReply(dto: CreateQuickReplyDto): Promise<QuickReplySummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const quickReply = await this.prisma.quickReply.create({
      data: { branchId, title: dto.title, body: dto.body },
    });
    return toSummary(quickReply);
  }

  async listQuickReplies(): Promise<QuickReplySummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const quickReplies = await this.prisma.quickReply.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
    return quickReplies.map(toSummary);
  }

  async updateQuickReply(id: string, dto: UpdateQuickReplyDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const existing = await this.prisma.quickReply.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException("Quick reply not found");
    }

    await this.prisma.quickReply.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return { id };
  }
}

function toSummary(quickReply: {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
}): QuickReplySummary {
  return {
    id: quickReply.id,
    title: quickReply.title,
    body: quickReply.body,
    isActive: quickReply.isActive,
  };
}
