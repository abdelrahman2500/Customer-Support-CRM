import type { CookieOptions } from "express";

/**
 * Deployment-configuration hardening — the cookie attributes for the
 * httpOnly refresh token, in one pure, unit-testable place.
 *
 * Both `IdentityController.setRefreshCookie` (agent sessions) and
 * `PortalController.setRefreshCookie` (customer-portal sessions) previously
 * built an identical options object inline with `sameSite: "strict"`
 * hard-coded. The values themselves are unchanged by default — this exists
 * because `SameSite` is a property of the *deployment topology*, not of the
 * application, and had no way to be configured:
 *
 * A browser sends a `SameSite=strict` cookie only on same-site requests,
 * where "same site" means the same registrable domain (not the same origin).
 * So `https://crm.example.com` calling `https://api.example.com` is
 * same-site and `strict` works, but the moment the browser origin and the
 * API origin sit on different registrable domains the request is cross-site,
 * the refresh cookie is never attached, and `POST /auth/refresh` /
 * `POST /portal/auth/refresh` / `POST /auth/switch-branch` all 401. The
 * visible symptom is a login that appears to succeed and then a session that
 * dies at the first access-token expiry (15 minutes by default) — with no
 * error anywhere in the API logs, because the request genuinely arrived
 * without a cookie. `AUTH_COOKIE_SAMESITE=none` is the fix for that
 * topology, and it is only meaningful together with `Secure`, which is why
 * `env.validation.ts` refuses `none` outside production.
 *
 * See docs/deployment.md ("Cookies, CORS and cross-site auth").
 */
export function buildRefreshCookieOptions(options: {
  /** `NODE_ENV`, which is what this app ties the `Secure` attribute to. */
  nodeEnv: "development" | "test" | "production";
  /** `AUTH_COOKIE_SAMESITE`. */
  sameSite: "strict" | "lax" | "none";
  /** `JWT_REFRESH_TTL_DAYS`. */
  refreshTtlDays: number;
  /** The cookie's `Path` — differs between the agent and portal auth routes. */
  path: string;
}): CookieOptions {
  return {
    httpOnly: true,
    secure: options.nodeEnv === "production",
    sameSite: options.sameSite,
    path: options.path,
    maxAge: options.refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}
