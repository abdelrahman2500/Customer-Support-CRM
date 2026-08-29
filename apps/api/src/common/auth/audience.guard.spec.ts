import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { AudienceGuard } from "./audience.guard";

function buildContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("AudienceGuard", () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let guard: AudienceGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    guard = new AudienceGuard(reflector as any);
  });

  it("allows the request through when request.user is absent (an unauthenticated @Public() route)", () => {
    const result = guard.canActivate(buildContext(undefined));

    expect(result).toBe(true);
  });

  it("allows an agent-audience token on a route not marked @PortalRoute()", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(buildContext({ audience: "agent" }));

    expect(result).toBe(true);
  });

  it("rejects a customer-audience token on a route not marked @PortalRoute()", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(() => guard.canActivate(buildContext({ audience: "customer" }))).toThrow(
      UnauthorizedException,
    );
  });

  it("allows a customer-audience token on a route marked @PortalRoute()", () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const result = guard.canActivate(buildContext({ audience: "customer" }));

    expect(result).toBe(true);
  });

  it("rejects an agent-audience token on a route marked @PortalRoute()", () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(() => guard.canActivate(buildContext({ audience: "agent" }))).toThrow(
      UnauthorizedException,
    );
  });
});
