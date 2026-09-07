import { SetMetadata } from "@nestjs/common";

export const API_KEY_SCOPES_KEY = "requiredApiKeyScopes";

/**
 * `@RequireApiKeyScope('integration:read')` — checked by `ApiKeyGuard`
 * against `ApiKey.scopes`, deliberately parallel to (never merged with)
 * `@RequirePermissions`/`PermissionsGuard`'s role-based RBAC: an API key
 * is not a user, has no roles, and its scopes are checked independently.
 * Only meaningful on a route also marked `@AllowApiKey()` — `ApiKeyGuard`
 * ignores this metadata entirely on any route without it.
 */
export const RequireApiKeyScope = (...scopes: string[]): MethodDecorator =>
  SetMetadata(API_KEY_SCOPES_KEY, scopes);
