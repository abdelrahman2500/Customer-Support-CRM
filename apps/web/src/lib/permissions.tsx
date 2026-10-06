"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Demo hardening — the signed-in user's permission keys (`GET /auth/me`'s
 * `permissions`), provided once by `WorkspaceShell`. The UI uses them only to
 * leave out what the API would refuse anyway — a navigation entry, a request
 * that would 403 — never to grant anything: every endpoint still enforces
 * its own permission.
 *
 * `undefined` means "unknown" (no provider, or an API that predates the
 * field), and everything stays visible, exactly as before permissions were
 * known here — a page the user cannot use still renders its own forbidden
 * state.
 */
const PermissionsContext = createContext<readonly string[] | undefined>(undefined);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: readonly string[] | undefined;
  children: ReactNode;
}) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

/** Whether `permissions` grants any of `required` (nothing required, or
 * unknown permissions, allows). */
export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  required: readonly string[] | undefined,
): boolean {
  if (!required || required.length === 0 || permissions === undefined) return true;
  return required.some((key) => permissions.includes(key));
}

export function usePermissions(): readonly string[] | undefined {
  return useContext(PermissionsContext);
}

/** Whether the signed-in user holds `permission` (true while unknown). */
export function useCan(permission: string): boolean {
  return hasAnyPermission(usePermissions(), [permission]);
}
