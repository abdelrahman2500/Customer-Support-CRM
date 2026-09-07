import { randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { ApiKeyHasher, API_KEY_PREFIX_LENGTH } from "./api-key-hash";
import type { CreateApiKeyDto } from "./dto/create-api-key.dto";

export interface ApiKeySummary {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdByUserId: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/** Returned only once — the create response, never again (mirrors
 * `WebhookSubscriptionCreated`'s own exact "one-time-reveal" shape, RM-20). */
export interface ApiKeyCreated extends ApiKeySummary {
  rawKey: string;
}

/**
 * RM-22 — API-Key Authentication for Machine-to-Machine Consumers. Pure
 * CRUD (mirrors `WebhookSubscriptionsService`'s exact `findXInScope`
 * 404-masking / `TenantContext.requireBranchScope()` shape) over `ApiKey`.
 * Never itself authenticates a request — `ApiKeyGuard`
 * (`common/auth/api-key.guard.ts`) owns that, using this same
 * `ApiKeyHasher` so the two can never compute a different hash for the
 * same raw key.
 */
@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly apiKeyHasher: ApiKeyHasher,
  ) {}

  async createApiKey(dto: CreateApiKeyDto): Promise<ApiKeyCreated> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const createdByUserId = this.requireAuthenticatedUserId();
    const rawKey = `crmk_${randomBytes(32).toString("base64url")}`;
    const hashedKey = this.apiKeyHasher.hash(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        branchId,
        label: dto.label,
        hashedKey,
        keyPrefix: rawKey.slice(0, API_KEY_PREFIX_LENGTH),
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdByUserId,
      },
    });

    return { ...toSummary(apiKey), rawKey };
  }

  async listApiKeys(): Promise<ApiKeySummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
    });
    return apiKeys.map(toSummary);
  }

  /** A revoke, not a hard delete — the row (and its `lastUsedAt`/audit
   * trail) stays, `revokedAt` just gets set. Matches the plan's own `DELETE
   * /admin/api-keys/:id (revoke)` semantics exactly: the HTTP verb is
   * DELETE, the effect is revocation. */
  async revokeApiKey(id: string): Promise<void> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const apiKey = await this.prisma.apiKey.findFirst({ where: { id, branchId } });
    if (!apiKey) {
      throw new NotFoundException("API key not found");
    }
    if (apiKey.revokedAt) {
      return;
    }
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  private requireAuthenticatedUserId(): string {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no authenticated user on this request");
    }
    return userId;
  }
}

function toSummary(apiKey: {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdByUserId: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}): ApiKeySummary {
  return {
    id: apiKey.id,
    label: apiKey.label,
    keyPrefix: apiKey.keyPrefix,
    scopes: apiKey.scopes,
    expiresAt: apiKey.expiresAt,
    revokedAt: apiKey.revokedAt,
    createdByUserId: apiKey.createdByUserId,
    lastUsedAt: apiKey.lastUsedAt,
    createdAt: apiKey.createdAt,
  };
}
