import { useQuery } from "@tanstack/react-query";
import { listMyBranchMemberships } from "@/lib/branch-memberships-api";

/**
 * Story 118 — dedicated hook, mirroring `use-reporting.ts`'s own
 * "own file, no import from an unrelated hooks file" convention.
 * Read-only — the mutation (`switchBranch`) lives in `lib/api.ts` itself
 * (see that file's own doc comment for why it's a raw `fetch`, not
 * routed through `apiFetch`/React Query the way an ordinary mutation
 * would be).
 */
export function useMyBranchMembershipsQuery() {
  return useQuery({ queryKey: ["auth", "me", "branches"], queryFn: listMyBranchMemberships });
}
