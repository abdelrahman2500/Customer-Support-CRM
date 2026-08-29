/** Base URL of `apps/api`, e.g. `http://localhost:3001/api/v1`. */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
}

/**
 * Story 52 — mirrors `apps/web/src/lib/api.ts` file-for-file, retargeted to
 * `/portal/auth/*` and a separate cookie name/path so an agent session and a
 * portal session in the same browser never collide.
 */
export const ACCESS_TOKEN_COOKIE = "crm_portal_access_token";

/**
 * Reads the same non-httpOnly access-token cookie the login page writes,
 * from the browser, for client-side `fetch` calls that cannot use the SSR
 * `next/headers` cookie reader `auth-server.ts` uses. Returns `null` when
 * not signed in or when called on the server.
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
 * Calls the real `POST /portal/auth/refresh`. A raw `fetch(...,
 * { credentials: "include" })`, not routed through `apiFetch`: this endpoint
 * is `@Public()` and authenticates via the httpOnly refresh-token cookie
 * alone (no Bearer header needed) — mirrors `apps/web`'s own
 * `refreshAccessToken` exactly.
 */
async function refreshAccessToken(): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/portal/auth/refresh`, {
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
 * Module-level in-flight-refresh guard — mirrors `apps/web`'s own
 * `refreshAccessTokenOnce` exactly (see that file's doc comment for why).
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
 * Calls the real `POST /portal/auth/logout`, revoking the refresh token
 * server-side. Best-effort: swallows any failure rather than throwing —
 * mirrors `apps/web`'s own `logout` exactly.
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/portal/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort — the caller always proceeds with local cleanup regardless.
  }
}

/** Performs one real request and turns a non-2xx response into a typed
 * `ApiError` — mirrors `apps/web`'s own `attempt` exactly. */
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
 * Shared fetch wrapper for every client-side API call in this app — mirrors
 * `apps/web/src/lib/api.ts`'s own `apiFetch` exactly, including the
 * once-only 401 retry via a real, de-duplicated `POST /portal/auth/refresh`.
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
      throw error;
    }

    try {
      return await attempt<T>(path, init, refreshedToken);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        clearAccessToken();
      }
      throw retryError;
    }
  }
}
