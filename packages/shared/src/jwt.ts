/**
 * Shape of the claims carried in the platform's JWT **access** token.
 *
 * See docs/architecture/05-auth-and-security.md — `audience` separates
 * agent/admin tokens from customer-portal tokens so a token issued for
 * one can never be accepted by an endpoint scoped to the other.
 */
export interface JwtAccessTokenClaims {
  /** User id (subject). */
  sub: string;
  /** Which surface this token is valid for. */
  audience: "agent" | "customer";
  /** Active branch for this session, or null if not yet selected/applicable. */
  branchId: string | null;
  /** Active department within the branch, or null. */
  departmentId: string | null;
  /** Role keys held by the user in the active branch/department. */
  roles: string[];
}

/**
 * Pair returned by the login and refresh endpoints. The refresh token is an
 * opaque random string, not a JWT — see docs/architecture/05-auth-and-security.md
 * and `apps/api/src/modules/identity/identity.service.ts`. Its validity is
 * decided by a database lookup (hash match + not expired/revoked), not by
 * decoding claims, so there's nothing to type beyond "it's a string".
 */
export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}
