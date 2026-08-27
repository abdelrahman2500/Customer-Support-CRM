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
 * Shared fetch wrapper for every client-side API call this story adds — one
 * place that attaches the bearer token and turns a non-2xx response into a
 * typed `ApiError` (Design item 5 of the plan: never assume an action
 * succeeds; the real backend response, including a 403/404, is what the UI
 * reacts to).
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
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
