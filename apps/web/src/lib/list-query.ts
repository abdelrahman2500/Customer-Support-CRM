import { keepPreviousData } from "@tanstack/react-query";

/**
 * Story S-7 — the one place a list query opts into keeping its previous
 * rows while a new query key resolves.
 *
 * ## What it fixes
 *
 * A list's filters are part of its query key (`["tickets", filters]`), so
 * changing a filter, a search term or a sort direction is a *new* query
 * with no cached data. That put the query back into `pending`, which made
 * `isLoading` true, which replaced the entire table with a skeleton — every
 * time, for every filter change, including a sort toggle that returns the
 * same rows in a different order. `keepPreviousData` serves the previous
 * key's data as placeholder data until the new key resolves, so the rows
 * stay put and `isPlaceholderData` marks them as being superseded.
 *
 * ## Why this is not a QueryClient default
 *
 * Applying it globally would be actively wrong for several query shapes in
 * this repository, all of which would then show one entity's data under
 * another's identity:
 *
 * - **Detail queries** — `useTicketQuery(id)`/`useCustomerQuery(id)` are
 *   keyed by id. Navigating from ticket A to ticket B would render A's
 *   subject, status and customer under B's URL until B arrived. That is not
 *   a stale list, it is the wrong record.
 * - **Branch-scoped queries** — `useMyBranchMembershipsQuery` and every
 *   branch-scoped list are re-fetched after `switchBranch`, which
 *   deliberately clears the cache precisely so nothing from the previous
 *   branch survives. Placeholder data would defeat that.
 * - **`useTicketSlaTargetQuery`/`useTicketCsatQuery`** and the other
 *   per-ticket sub-queries — same identity problem as detail queries, and
 *   an SLA countdown carried over from another ticket is worse than a
 *   spinner.
 *
 * So it is opt-in, and applied only to the queries whose key changes
 * because a *filter over the same collection* changed. Those are the only
 * ones where the previous data is a genuine, honest preview of the next.
 *
 * ## v5 API
 *
 * `placeholderData: keepPreviousData` — not the v4 `keepPreviousData: true`
 * boolean option, which no longer exists in the v5 this repository uses
 * (`@tanstack/react-query` 5.102.2).
 */
export const preservePreviousResults = {
  placeholderData: keepPreviousData,
} as const;
