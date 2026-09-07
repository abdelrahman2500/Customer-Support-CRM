import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard as PassportAuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ALLOW_API_KEY_KEY } from "./allow-api-key.decorator";

/**
 * Registered globally (see `app.module.ts`, `APP_GUARD`) per
 * docs/architecture/02-system-architecture-overview.md — authentication is a
 * cross-cutting concern applied everywhere, not opted into per controller.
 * Routes decorated with `@Public()` (login, refresh, health) skip it.
 *
 * RM-22 — a route additionally marked `@AllowApiKey()` gets one narrow
 * change: when the JWT strategy rejects the request (missing/invalid/
 * expired bearer token — the same rejection every other route still throws
 * immediately), this guard no longer hard-fails it. Instead it lets the
 * request through so `ApiKeyGuard` (registered later in the same
 * `APP_GUARD` chain) gets the one and only chance to authenticate it as an
 * API key instead. A genuinely valid JWT on an `@AllowApiKey()` route still
 * authenticates here exactly as before — `super.canActivate()` succeeds
 * and `ApiKeyGuard` then no-ops (`request.user` is already set). Every
 * route without `@AllowApiKey()` — the entire pre-existing surface — is
 * completely untouched: the same unconditional `super.canActivate(context)`
 * call as before this story, no try/catch.
 */
@Injectable()
export class AuthGuard extends PassportAuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowsApiKey = this.reflector.getAllAndOverride<boolean>(ALLOW_API_KEY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowsApiKey) {
      return (await super.canActivate(context)) as boolean;
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return true;
    }
  }
}
