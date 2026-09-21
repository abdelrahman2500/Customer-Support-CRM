import { useMutation } from "@tanstack/react-query";
import { changeOwnPassword } from "@/lib/api";

/**
 * Story 147 — Self-Service Password Management, portal side. Mirrors
 * `apps/web`'s own `useChangePasswordMutation`, minus its
 * `["auth", "sessions"]` invalidation: the portal has no session-list
 * screen to invalidate (`GET /auth/sessions` is an agent-only route).
 */
export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      changeOwnPassword(input),
  });
}
