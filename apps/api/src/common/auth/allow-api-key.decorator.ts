import { SetMetadata } from "@nestjs/common";

export const ALLOW_API_KEY_KEY = "allowApiKey";

/**
 * RM-22 — marks a route as reachable by EITHER a normal JWT bearer token
 * (unchanged) OR a valid `Authorization: Bearer <api-key>` request. Checked
 * by `AuthGuard` (to avoid hard-rejecting a JWT-verification failure on
 * this route before `ApiKeyGuard` gets a chance) and by `ApiKeyGuard`
 * itself (to skip entirely on every other route). Almost always paired
 * with `@RequireApiKeyScope(...)` — see that decorator's own doc comment.
 */
export const AllowApiKey = (): MethodDecorator & ClassDecorator => SetMetadata(ALLOW_API_KEY_KEY, true);
