/**
 * The authenticated user shape exposed by `GET /api/v1/auth/me` and used
 * by both `apps/web` and `apps/portal` to render session-dependent UI.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  branchId: string | null;
  departmentId: string | null;
  roles: string[];
}

/**
 * Story 52 — the authenticated-contact shape exposed by
 * `GET /api/v1/portal/auth/me`, used by `apps/portal` to render
 * session-dependent UI. Mirrors `AuthenticatedUser`'s shape for a `Contact`
 * — no `roles`/`departmentId`: Contacts have no role/permission concept
 * anywhere in this codebase (that system is agent-only).
 */
export interface AuthenticatedContact {
  id: string;
  email: string;
  fullName: string;
  customerId: string;
}
