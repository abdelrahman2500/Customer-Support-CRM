import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { buildRefreshCookieOptions } from "../../common/config/refresh-cookie";
import { LoginDto } from "./dto/login.dto";
import { SwitchBranchDto } from "./dto/switch-branch.dto";
import { UpdateLocaleDto } from "./dto/update-locale.dto";
import type { BranchMembershipSummary, SessionSummary } from "./identity.service";
import { IdentityService } from "./identity.service";

const REFRESH_COOKIE_NAME = "refreshToken";

// Story 100 — tighter than the global default (100/60s, `app.module.ts`),
// mirroring `WebFormIntakeController`'s own `@Throttle` override precedent.
// Story 122 (account lockout) added a real, end-to-end e2e lockout test
// that itself drives several accounts to their 5-attempt threshold, pushing
// `identity.e2e-spec.ts`'s own real usage from ~25 up to ~48 login calls
// within its single run — still the highest of any existing spec file. 80
// sits comfortably above that (with headroom for future coverage) while
// remaining a meaningfully stricter, dedicated limit than the global
// default on the exact endpoints a credential-stuffing/brute-force attempt
// would target.
const AUTH_THROTTLE = { default: { limit: 80, ttl: 60_000 } };

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
      request.headers["user-agent"] ?? null,
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
    const { accessToken, refreshToken } = await this.identityService.refresh(
      presented,
      request.ip ?? null,
      request.headers["user-agent"] ?? null,
    );
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

  /** Story 119 — persists the caller's own locale preference. Ordinary
   * `AuthGuard`, no extra permission (a personal presentation setting,
   * mirrors `me` above's own no-extra-permission precedent). No token
   * reissue: locale is not a `JwtAccessTokenClaims` field. */
  @Patch("locale")
  async updateLocale(
    @Req() request: Request,
    @Body() dto: UpdateLocaleDto,
  ): Promise<{ id: string }> {
    const user = request.user as JwtAccessTokenClaims;
    return this.identityService.updatePreferredLocale(user.sub, dto.locale);
  }

  /** Story 118 — the caller's own branch/department/role memberships,
   * flagging the currently-active one. No extra permission gate — the
   * caller's own data, mirrors `me` above's identical precedent. */
  @Get("me/branches")
  async myBranches(): Promise<BranchMembershipSummary[]> {
    return this.identityService.listMyBranchMemberships();
  }

  /** Story 124 — the caller's own active sessions (one per logged-in
   * device/browser), flagging which one is the current request's own.
   * No extra permission gate — the caller's own data, mirrors `me`/
   * `myBranches`'s identical precedent. */
  @Get("sessions")
  async sessions(@Req() request: Request): Promise<SessionSummary[]> {
    const presented = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    return this.identityService.listMySessions(presented ?? null);
  }

  /** Story 124 — revokes one of the caller's own sessions by id,
   * immediately preventing that device from refreshing again without
   * affecting any of their other sessions. */
  @Delete("sessions/:sessionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@Param("sessionId") sessionId: string): Promise<void> {
    await this.identityService.revokeSession(sessionId);
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
      request.ip ?? null,
      request.headers["user-agent"] ?? null,
    );
    this.setRefreshCookie(response, refreshToken);
    return { accessToken };
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(
      REFRESH_COOKIE_NAME,
      token,
      buildRefreshCookieOptions({
        nodeEnv: this.configService.get("NODE_ENV", { infer: true }),
        sameSite: this.configService.get("AUTH_COOKIE_SAMESITE", { infer: true }),
        refreshTtlDays: this.configService.get("JWT_REFRESH_TTL_DAYS", { infer: true }),
        path: "/api/v1/auth",
      }),
    );
  }
}
