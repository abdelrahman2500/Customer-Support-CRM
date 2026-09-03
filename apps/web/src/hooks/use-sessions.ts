import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMySessions, revokeSession } from "@/lib/sessions-api";

/**
 * Story 124 — Session/Device Management. Dedicated hook file, mirroring
 * `use-branch-memberships.ts`'s own "own file, no import from an unrelated
 * hooks file" convention.
 */
export function useMySessionsQuery() {
  return useQuery({ queryKey: ["auth", "sessions"], queryFn: listMySessions });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
  });
}
