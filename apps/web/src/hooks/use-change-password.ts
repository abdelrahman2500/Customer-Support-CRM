import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changeOwnPassword } from "@/lib/account-api";
import type { ChangeOwnPasswordInput } from "@/lib/account-api";

/**
 * Story 147 — Self-Service Password Management. Dedicated hook file,
 * mirroring `use-sessions.ts`'s own "own file, no import from an unrelated
 * hooks file" convention.
 *
 * Invalidates `["auth", "sessions"]` on success because the backend revokes
 * every refresh token for the user as part of the change (see
 * `IdentityService.changeOwnPassword`) — the session list rendered beside
 * this form on the same page is stale the moment the change succeeds.
 */
export function useChangePasswordMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeOwnPasswordInput) => changeOwnPassword(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
  });
}
