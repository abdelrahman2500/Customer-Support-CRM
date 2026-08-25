import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { PermissionsGuard } from "./permissions.guard";

function buildContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("PermissionsGuard", () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let prisma: { permission: { findMany: ReturnType<typeof vi.fn> } };
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    prisma = { permission: { findMany: vi.fn() } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    guard = new PermissionsGuard(reflector as any, prisma as any);
  });

  it("allows the request through when no permissions are required", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = await guard.canActivate(buildContext({ roles: [] }));

    expect(result).toBe(true);
    expect(prisma.permission.findMany).not.toHaveBeenCalled();
  });

  it("denies defensively when permissions are required but request.user is missing", async () => {
    reflector.getAllAndOverride.mockReturnValue(["user:create"]);

    const result = await guard.canActivate(buildContext(undefined));

    expect(result).toBe(false);
  });

  it("allows when the caller's roles grant every required permission", async () => {
    reflector.getAllAndOverride.mockReturnValue(["user:create", "user:read"]);
    prisma.permission.findMany.mockResolvedValue([{ key: "user:create" }, { key: "user:read" }]);

    const result = await guard.canActivate(buildContext({ roles: ["SuperAdmin"] }));

    expect(result).toBe(true);
  });

  it("throws ForbiddenException when a required permission is missing", async () => {
    reflector.getAllAndOverride.mockReturnValue(["user:create"]);
    prisma.permission.findMany.mockResolvedValue([]); // Agent role: no grants

    await expect(guard.canActivate(buildContext({ roles: ["Agent"] }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
