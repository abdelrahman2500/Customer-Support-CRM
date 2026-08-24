import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard as PassportAuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "./public.decorator";

/**
 * Registered globally (see `app.module.ts`, `APP_GUARD`) per
 * docs/architecture/02-system-architecture-overview.md — authentication is a
 * cross-cutting concern applied everywhere, not opted into per controller.
 * Routes decorated with `@Public()` (login, refresh, health) skip it.
 */
@Injectable()
export class AuthGuard extends PassportAuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
