import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { AuthenticatedUser, JwtAccessTokenClaims } from "@crm/shared";
import { Public } from "../../common/auth/public.decorator";
import type { EnvConfig } from "../../common/config/env.validation";
import { LoginDto } from "./dto/login.dto";
import { SwitchBranchDto } from "./dto/switch-branch.dto";
import type { BranchMembershipSummary } from "./identity.service";
import { IdentityService } from "./identity.service";

const REFRESH_COOKIE_NAME = "refreshToken";

// Story 100 — tighter than the global default (100/60s, `app.module.ts`),
// mirroring `WebFormIntakeController`'s own `@Throttle` override precedent.
// 40 sits comfortably above `identity.e2e-spec.ts`'s own real usage (25
// login calls within its single run — the highest of any existing spec
// file), so this does not break any existing test's own login/refresh
// budget while still being a meaningfully stricter, dedicated limit on the
// exact endpoints a credential-stuffing/brute-force attempt would target.
const AUTH_THROTTLE = { default: { limit: 40, ttl: 60_000 } };

@ApiTags("auth")
@Controller("auth")
export class IdentityController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const { accessToken, refreshToken } = await this.identityService.login(
      dto.email,
      dto.password,
      request.ip ?? null,
    );
    this.setRefreshCookie(response, refreshToken);
    return { accessToken };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const presented = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!presented) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const { accessToken, refreshToken } = await this.identityService.refresh(presented);
    this.setRefreshCookie(response, refreshToken);
    return { accessToken };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const presented = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (presented) {
      await this.identityService.revoke(presented, request.ip ?? null);
    }
    response.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/v1/auth" });
  }

  @Get("me")
  async me(@Req() request: Request): Promise<AuthenticatedUser> {
    const user = request.user as JwtAccessTokenClaims;
    return this.identityService.getAuthenticatedUser(user.sub);
  }

  /** Story 118 — the caller's own branch/department/role memberships,
   * flagging the currently-active one. No extra permission gate — the
   * caller's own data, mirrors `me` above's identical precedent. */
  @Get("me/branches")
  async myBranches(): Promise<BranchMembershipSummary[]> {
    return this.identityService.listMyBranchMemberships();
  }

  /**
   * Story 118 — switches the caller's active branch/department to one
   * of their OTHER existing memberships (granted via `POST
   * identity/users/:id/branch-assignments`). Lives under `auth/*`, not
   * `identity/*`: the refresh-token cookie is scoped to
   * `path: "/api/v1/auth"` (see `setRefreshCookie` below) — a route
   * outside that prefix would never receive it. `@Public()` +
   * cookie-only, mirroring `refresh` above exactly: the presented
   * refresh token alone identifies the caller, no Bearer access token
   * required.
   */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("switch-branch")
  @HttpCode(HttpStatus.OK)
  async switchBranch(
    @Body() dto: SwitchBranchDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const presented = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!presented) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const { accessToken, refreshToken } = await this.identityService.switchActiveBranch(
      presented,
      dto.branchId,
      dto.departmentId ?? null,
    );
    this.setRefreshCookie(response, refreshToken);
    return { accessToken };
  }

  private setRefreshCookie(response: Response, token: string): void {
    const isProduction = this.configService.get("NODE_ENV", { infer: true }) === "production";
    const ttlDays = this.configService.get("JWT_REFRESH_TTL_DAYS", { infer: true });
    response.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    });
  }
}
