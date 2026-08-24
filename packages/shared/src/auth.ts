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
