import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";
import { ALLOW_API_KEY_KEY } from "./allow-api-key.decorator";
import { API_KEY_SCOPES_KEY } from "./require-api-key-scope.decorator";

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function buildReflectorMock(metadata: Record<string, unknown>) {
  return { getAllAndOverride: vi.fn((key: string) => metadata[key]) };
}

const API_KEY_ROW = {
  id: "key-1",
  branchId: "branch-1",
  label: "CI bot",
  hashedKey: "hashed-value",
  keyPrefix: "crmk_abc",
  scopes: ["integration:read"],
  expiresAt: null as Date | null,
  revokedAt: null as Date | null,
  createdByUserId: "user-1",
  lastUsedAt: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

describe("ApiKeyGuard", () => {
  let prisma: { apiKey: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
  let hasher: { hash: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = { apiKey: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) } };
    hasher = { hash: vi.fn(() => "hashed-value") };
  });

  function createGuard(metadata: Record<string, unknown>): ApiKeyGuard {
    const reflector = buildReflectorMock(metadata);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new ApiKeyGuard(reflector as any, prisma as any, hasher as any);
  }

  it("is a no-op on a route without @AllowApiKey() — never queries Prisma", async () => {
    const guard = createGuard({ [ALLOW_API_KEY_KEY]: undefined });

    const result = await guard.canActivate(buildContext({ headers: {} }));

    expect(result).toBe(true);
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it("is a no-op when JWT already authenticated the request (request.user set)", async () => {
    const guard = createGuard({ [ALLOW_API_KEY_KEY]: true });

    const result = await guard.canActivate(
      buildContext({ user: { sub: "user-1" }, headers: {} }),
    );

    expect(result).toBe(true);
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it("rejects with 401 when no Authorization header is present", async () => {
    const guard = createGuard({ [ALLOW_API_KEY_KEY]: true });

    await expect(guard.canActivate(buildContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects with 401 when the hashed key matches no row", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    const guard = createGuard({ [ALLOW_API_KEY_KEY]: true });

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: "Bearer crmk_abc" } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(hasher.hash).toHaveBeenCalledWith("crmk_abc");
  });

  it("rejects with 401 when the matched key has been revoked", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...API_KEY_ROW, revokedAt: new Date() });
    const guard = createGuard({ [ALLOW_API_KEY_KEY]: true });

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: "Bearer crmk_abc" } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects with 401 when the matched key has expired", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({
      ...API_KEY_ROW,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const guard = createGuard({ [ALLOW_API_KEY_KEY]: true });

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: "Bearer crmk_abc" } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects with 403 when the key is valid but missing a required scope", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...API_KEY_ROW, scopes: ["integration:read"] });
    const guard = createGuard({
      [ALLOW_API_KEY_KEY]: true,
      [API_KEY_SCOPES_KEY]: ["integration:write"],
    });

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: "Bearer crmk_abc" } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("accepts a valid, unrevoked, unexpired key carrying every required scope", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...API_KEY_ROW, scopes: ["integration:read"] });
    const guard = createGuard({
      [ALLOW_API_KEY_KEY]: true,
      [API_KEY_SCOPES_KEY]: ["integration:read"],
    });
    const request: Record<string, unknown> = { headers: { authorization: "Bearer crmk_abc" } };

    const result = await guard.canActivate(buildContext(request));

    expect(result).toBe(true);
  });

  it("populates request.tenantClaims from the key's own branchId/createdByUserId, with empty roles", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(API_KEY_ROW);
    const guard = createGuard({ [ALLOW_API_KEY_KEY]: true });
    const request: Record<string, unknown> = { headers: { authorization: "Bearer crmk_abc" } };

    await guard.canActivate(buildContext(request));

    expect(request.tenantClaims).toEqual({
      userId: "user-1",
      branchId: "branch-1",
      departmentId: null,
      roles: [],
    });
    expect(request.apiKey).toEqual(API_KEY_ROW);
  });

  it("records lastUsedAt best-effort, without blocking or failing the request if it errors", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(API_KEY_ROW);
    prisma.apiKey.update.mockRejectedValue(new Error("db unavailable"));
    const guard = createGuard({ [ALLOW_API_KEY_KEY]: true });

    const result = await guard.canActivate(
      buildContext({ headers: { authorization: "Bearer crmk_abc" } }),
    );

    expect(result).toBe(true);
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});
