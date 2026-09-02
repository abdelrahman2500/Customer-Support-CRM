import { emitAuthExpired } from "./auth-events";

/** Base URL of `apps/api`, e.g. `http://localhost:3001/api/v1`. */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
}

/**
 * Story 23 — the origin the Socket.IO client connects to (Story 20's
 * `RealtimeGateway`, default namespace at the server's own origin, not
 * under `/api/v1`). Derived from the same `NEXT_PUBLIC_API_URL` the REST
 * client already uses, not a second environment variable.
 */
export function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
}

export const ACCESS_TOKEN_COOKIE = "crm_access_token";

/**
 * Story 23 — reads the same non-httpOnly access-token cookie the login page
 * writes (Story 02's own design decision, unchanged by this story) from the
 * browser, for client-side `fetch`/Socket.IO calls that cannot use the SSR
 * `next/headers` cookie reader `apps/web`'s existing dashboard placeholder
 * used. Returns `null` when not signed in or when called on the server.
 */
export function getAccessToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(ACCESS_TOKEN_COOKIE.length + 1)) : null;
}

export function clearAccessToken(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
}

/**
 * Story 41 — factored out of the login page's own inline
 * `document.cookie = ...` write (same cookie name/path/max-age/samesite, no
 * behavior change) so the silent-refresh success path below doesn't
 * duplicate that cookie-string construction a second time.
 */
export function setAccessToken(token: string): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${token}; path=/; max-age=900; samesite=lax`;
}

/** Thrown by the typed API client helpers below; carries the real HTTP status
 * so callers can distinguish "backend rejected this" from a network failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Story 41 — calls the real `POST /auth/refresh`. A raw `fetch(...,
 * { credentials: "include" })`, not routed through `apiFetch`: this endpoint
 * is `@Public()` and authenticates via the httpOnly refresh-token cookie
 * alone (no Bearer header needed), mirroring the login page's own existing
 * pattern — and routing it through `apiFetch` would let a failing refresh
 * recursively trigger another refresh attempt via `apiFetch`'s own 401
 * handling below. Throws on any non-2xx response; on success, persists the
 * new access token via `setAccessToken` and returns it.
 */
async function refreshAccessToken(): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError("Session refresh failed", response.status);
  }
  const { accessToken } = (await response.json()) as { accessToken: string };
  setAccessToken(accessToken);
  return accessToken;
}

/**
 * Story 118 — switches the caller's active branch/department to one of
 * their OTHER existing memberships. Mirrors `refreshAccessToken()`'s
 * exact pattern: a raw `fetch(..., { credentials: "include" })`, not
 * routed through `apiFetch` — `POST auth/switch-branch` is `@Public()`
 * and authenticates via the httpOnly refresh-token cookie alone (no
 * Bearer header needed), exactly like `refreshAccessToken`'s own doc
 * comment explains for `/auth/refresh`. Throws `ApiError` on any non-2xx
 * response (e.g. a `404` for a branch/department the caller doesn't
 * actually hold); on success, persists the new access token and returns
 * it.
 */
export async function switchBranch(branchId: string, departmentId?: string): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/auth/switch-branch`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId, ...(departmentId !== undefined ? { departmentId } : {}) }),
  });
  if (!response.ok) {
    throw new ApiError("Failed to switch branch", response.status);
  }
  const { accessToken } = (await response.json()) as { accessToken: string };
  setAccessToken(accessToken);
  return accessToken;
}

/**
 * Story 119 — persists the caller's own locale preference. Unlike
 * `switchBranch` above, this is an ordinary Bearer-authenticated call
 * through `apiFetch` (locale isn't a JWT claim, so no cookie/token
 * dance is needed) — defined here, not in a separate file, since it's a
 * one-line addition to the same auth surface `switchBranch`/`logout`
 * already live in.
 */
export function updatePreferredLocale(locale: "en" | "ar"): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/auth/locale", {
    method: "PATCH",
    body: JSON.stringify({ locale }),
  });
}

/**
 * Story 41 — module-level in-flight-refresh guard. `POST /auth/refresh`
 * rotates and revokes the presented refresh token server-side
 * (`identity.service.ts`), so two independent, concurrent refresh calls
 * would race: the second would present a token the first just revoked and
 * fail a session that was actually fine. Every concurrent 401 therefore
 * awaits this same in-flight promise instead of starting its own; it is
 * cleared once the refresh settles (success or failure) so the next,
 * independent expiry starts a fresh one.
 */
let inFlightRefresh: Promise<string> | null = null;

function refreshAccessTokenOnce(): Promise<string> {
  if (!inFlightRefresh) {
    inFlightRefresh = refreshAccessToken().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

/**
 * Story 41 — calls the real `POST /auth/logout`, revoking the refresh token
 * server-side. Best-effort: swallows any failure (network error or non-2xx)
 * rather than throwing, since the caller (`WorkspaceNav`'s sign-out) must
 * always complete the user's local sign-out regardless of whether the
 * server round-trip succeeded. Same raw-`fetch`-with-credentials pattern as
 * `refreshAccessToken` — also `@Public()`, also not routed through
 * `apiFetch`.
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort — the caller always proceeds with local cleanup regardless.
  }
}

/** Performs one real request and turns a non-2xx response into a typed
 * `ApiError`, exactly as `apiFetch` always has — extracted so `apiFetch`
 * below can call it a second time after a successful silent refresh. */
async function attempt<T>(path: string, init: RequestInit, token: string | null): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
      }
    } catch {
      // Response body wasn't JSON — keep the generic status-based message.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * Shared fetch wrapper for every client-side API call in the app — one place
 * that attaches the bearer token and turns a non-2xx response into a typed
 * `ApiError` (Design item 5 of the Story 23 plan: never assume an action
 * succeeds; the real backend response, including a 403/404, is what the UI
 * reacts to).
 *
 * Story 41 — a `401` (an expired/invalid access token, per the global
 * `AuthGuard`) is retried exactly once after a real, de-duplicated
 * `POST /auth/refresh`. A `403` (a real permission rejection) is thrown
 * immediately, unchanged — refreshing the token cannot change what the user
 * is permitted to do, so it is never treated as a refresh trigger. If the
 * refresh itself fails, or the retried request still 401s, the access-token
 * cookie is cleared and the original `ApiError(401, ...)` is thrown exactly
 * as an unrefreshed 401 always has — every existing caller's `isError`/
 * `mutation.isError` rendering is unaffected.
 *
 * Story 95 - both of those "session is genuinely dead" outcomes also call
 * emitAuthExpired(), so AuthRecoveryListener can force a redirect to
 * /login instead of leaving the caller stranded on the now-broken
 * protected page (see ./auth-events's doc comment).
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await attempt<T>(path, init, getAccessToken());
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    let refreshedToken: string;
    try {
      refreshedToken = await refreshAccessTokenOnce();
    } catch {
      clearAccessToken();
      emitAuthExpired();
      throw error;
    }

    try {
      return await attempt<T>(path, init, refreshedToken);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        clearAccessToken();
        emitAuthExpired();
      }
      throw retryError;
    }
  }
}
