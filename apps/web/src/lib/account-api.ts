import { apiFetch } from "./api";

/**
 * Story 147 — Self-Service Password Management. A dedicated API client
 * file, mirroring `sessions-api.ts`'s own "distinct concern, own file"
 * convention rather than growing `api.ts`, which owns the token/refresh
 * machinery itself.
 *
 * Mirrors the backend's `ChangeOwnPasswordDto`
 * (`apps/api/src/modules/identity/dto/change-own-password.dto.ts`) exactly.
 * `confirmNewPassword` is deliberately NOT part of this payload — it is a
 * client-side typo guard only, and the backend has no field for it.
 */
export interface ChangeOwnPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function changeOwnPassword(input: ChangeOwnPasswordInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/auth/me/password", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
