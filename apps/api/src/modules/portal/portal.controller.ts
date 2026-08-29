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
import type { Request, Response } from "express";
import type { AuthenticatedContact, JwtAccessTokenClaims } from "@crm/shared";
import { Public } from "../../common/auth/public.decorator";
import { PortalRoute } from "../../common/auth/portal-route.decorator";
import type { EnvConfig } from "../../common/config/env.validation";
import { PortalLoginDto } from "./dto/portal-login.dto";
import { PortalService } from "./portal.service";

const REFRESH_COOKIE_NAME = "crm_portal_refresh_token";
const REFRESH_COOKIE_PATH = "/api/v1/portal/auth";

/**
 * Story 52 — the Customer Portal's auth surface, mirroring
 * `IdentityController`'s exact route/cookie shape (`login`/`refresh`/
 * `logout`/`me`) — a separate cookie name/path so an agent session and a
 * portal session in the same browser never collide with `crm_access_token`/
 * `refreshToken`. `login`/`refresh`/`logout` are `@Public()` (no token
 * exists yet); `me` is `@PortalRoute()` — `AudienceGuard` requires a
 * `customer`-audience token here and rejects an `agent`-audience one.
 */
@ApiTags("portal")
@Controller("portal/auth")
export class PortalController {
  constructor(
    private readonly portalService: PortalService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: PortalLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const { accessToken, refreshToken } = await this.portalService.login(dto.email, dto.password);
    this.setRefreshCookie(response, refreshToken);
    return { accessToken };
  }

  @Public()
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
    const { accessToken, refreshToken } = await this.portalService.refresh(presented);
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
      await this.portalService.revoke(presented);
    }
    response.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @PortalRoute()
  @Get("me")
  async me(@Req() request: Request): Promise<AuthenticatedContact> {
    const contact = request.user as JwtAccessTokenClaims;
    return this.portalService.getAuthenticatedContact(contact.sub);
  }

  private setRefreshCookie(response: Response, token: string): void {
    const isProduction = this.configService.get("NODE_ENV", { infer: true }) === "production";
    const ttlDays = this.configService.get("JWT_REFRESH_TTL_DAYS", { infer: true });
    response.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    });
  }
}
