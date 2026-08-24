import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "requiredPermissions";

/**
 * `@RequirePermissions('ticket:reassign')` — see
 * docs/architecture/05-auth-and-security.md. Checked by `PermissionsGuard`
 * against the permissions attached to the caller's roles, resolved fresh
 * from the database on every request (not from stale JWT claims), so a
 * permission change takes effect immediately rather than only after the
 * access token expires and is reissued.
 */
export const RequirePermissions = (...permissions: string[]): MethodDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
