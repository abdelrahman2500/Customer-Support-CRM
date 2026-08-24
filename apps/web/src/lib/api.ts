/** Base URL of `apps/api`, e.g. `http://localhost:3001/api/v1`. */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
}

export const ACCESS_TOKEN_COOKIE = "crm_access_token";
