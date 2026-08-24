import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route as exempt from the global `AuthGuard` — used for
 * `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, and health checks.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
