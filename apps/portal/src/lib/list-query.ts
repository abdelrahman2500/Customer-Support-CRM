import { keepPreviousData } from "@tanstack/react-query";

/**
 * Story S-7 — the portal's own copy of the agent workspace's
 * `list-query.ts`. See that file for the full rationale; the short version:
 *
 * - a list's search term is part of its query key, so typing in the search
 *   box is a new query with no cached data, which put the list back into
 *   `pending` and replaced it with a skeleton;
 * - `placeholderData: keepPreviousData` (the v5 API — not v4's
 *   `keepPreviousData: true`) keeps the previous results visible until the
 *   new ones arrive;
 * - it stays opt-in rather than a QueryClient default, because a detail
 *   query keyed by id would then render the previously viewed ticket's
 *   contents under the new ticket's URL.
 *
 * Duplicated across the two apps rather than shared, for the same reason
 * `ticket-badges.ts` is: there is no shared domain/query package yet, and
 * `@crm/ui` holds presentation primitives and must not take a dependency on
 * TanStack Query.
 */
export const preservePreviousResults = {
  placeholderData: keepPreviousData,
} as const;
