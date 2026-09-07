import { randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { paginate } from "../../common/pagination/paginate";
import type { Paginated } from "../../common/pagination/paginated";
import type { CreateWebhookSubscriptionDto } from "./dto/create-webhook-subscription.dto";
import type { UpdateWebhookSubscriptionDto } from "./dto/update-webhook-subscription.dto";
import type { ListWebhookDeliveryAttemptsQueryDto } from "./dto/list-webhook-delivery-attempts-query.dto";

export interface WebhookSubscriptionSummary {
  id: string;
  targetUrl: string;
  subscribedEventTypes: string[];
  isActive: boolean;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Returned only once — the create response, never again (`getSubscription`/
 * `listSubscriptions` never select `secret`). Mirrors how a real webhook
 * provider (Stripe, GitHub) hands back a signing secret exactly once. */
export interface WebhookSubscriptionCreated extends WebhookSubscriptionSummary {
  secret: string;
}

export interface WebhookDeliveryAttemptSummary {
  id: string;
  eventType: string;
  succeeded: boolean;
  responseStatus: number | null;
  errorMessage: string | null;
  attemptedAt: Date;
}

/**
 * RM-20 — Webhook Subscriptions + Outbound Event Dispatch. Pure CRUD over
 * `WebhookSubscription` (mirrors `AutomationRulesService`'s exact
 * `findXInScope` 404-masking / `TenantContext.requireBranchScope()` shape),
 * plus a read-only view over the `WebhookDeliveryAttempt` history
 * `apps/worker`'s `WebhookDispatchProcessor` writes. Never itself dispatches
 * a webhook — `WebhookDispatchListener` (this same module) owns that.
 */
@Injectable()
export class WebhookSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createSubscription(dto: CreateWebhookSubscriptionDto): Promise<WebhookSubscriptionCreated> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const createdByUserId = this.requireAuthenticatedUserId();
    const secret = randomBytes(32).toString("hex");

    const subscription = await this.prisma.webhookSubscription.create({
      data: {
        branchId,
        targetUrl: dto.targetUrl,
        secret,
        subscribedEventTypes: dto.subscribedEventTypes,
        createdByUserId,
      },
    });

    return { ...toSummary(subscription), secret };
  }

  async listSubscriptions(): Promise<WebhookSubscriptionSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
    });
    return subscriptions.map(toSummary);
  }

  async getSubscription(id: string): Promise<WebhookSubscriptionSummary> {
    const subscription = await this.findSubscriptionInScope(id);
    return toSummary(subscription);
  }

  async updateSubscription(
    id: string,
    dto: UpdateWebhookSubscriptionDto,
  ): Promise<WebhookSubscriptionSummary> {
    await this.findSubscriptionInScope(id);
    const subscription = await this.prisma.webhookSubscription.update({
      where: { id },
      data: {
        ...(dto.targetUrl !== undefined ? { targetUrl: dto.targetUrl } : {}),
        ...(dto.subscribedEventTypes !== undefined
          ? { subscribedEventTypes: dto.subscribedEventTypes }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return toSummary(subscription);
  }

  /** A hard delete, distinct from `updateSubscription({ isActive: false })`
   * — deactivating pauses dispatch and keeps the delivery-attempt history
   * around; this removes the subscription (and, via `onDelete: Cascade`,
   * its history) permanently. Both are exposed: the plan names DELETE
   * alongside POST/GET/PATCH explicitly. */
  async deleteSubscription(id: string): Promise<void> {
    await this.findSubscriptionInScope(id);
    await this.prisma.webhookSubscription.delete({ where: { id } });
  }

  async listDeliveryAttempts(
    id: string,
    query: ListWebhookDeliveryAttemptsQueryDto = {},
  ): Promise<Paginated<WebhookDeliveryAttemptSummary>> {
    await this.findSubscriptionInScope(id);
    const { items: attempts, ...pagination } = await paginate(this.prisma.webhookDeliveryAttempt, {
      where: { subscriptionId: id },
      orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      ...pagination,
      items: attempts.map((attempt) => ({
        id: attempt.id,
        eventType: attempt.eventType,
        succeeded: attempt.succeeded,
        responseStatus: attempt.responseStatus,
        errorMessage: attempt.errorMessage,
        attemptedAt: attempt.attemptedAt,
      })),
    };
  }

  private async findSubscriptionInScope(id: string): Promise<{
    id: string;
    targetUrl: string;
    subscribedEventTypes: string[];
    isActive: boolean;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const subscription = await this.prisma.webhookSubscription.findFirst({ where: { id, branchId } });
    if (!subscription) {
      throw new NotFoundException("Webhook subscription not found");
    }
    return subscription;
  }

  private requireAuthenticatedUserId(): string {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no authenticated user on this request");
    }
    return userId;
  }
}

function toSummary(subscription: {
  id: string;
  targetUrl: string;
  subscribedEventTypes: string[];
  isActive: boolean;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): WebhookSubscriptionSummary {
  return {
    id: subscription.id,
    targetUrl: subscription.targetUrl,
    subscribedEventTypes: subscription.subscribedEventTypes,
    isActive: subscription.isActive,
    createdByUserId: subscription.createdByUserId,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}
