"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Batch 4 (UX audit) — the one place a list view's filters/search/sort/page
 * state is synced with the URL's query string.
 *
 * ## What it fixes
 *
 * Every list view in this codebase kept its filters in a plain `useState`,
 * so a filter, a search term, a sort, or a page change was invisible to the
 * URL. That meant: no bookmark/share of a filtered view, no browser
 * back/forward through filter changes, and — the concrete case the Recon
 * flagged — navigating from a filtered/paged list into a detail view and
 * back (via the browser's own Back button) silently reset the list to its
 * defaults, because the URL never captured where you were.
 *
 * ## Why a generic hook, not a copy per view
 *
 * Every list view's filters object has a different shape (`ListTicketsFilters`
 * has an array field and a numeric `page`; `ListCustomersFilters` doesn't),
 * so there is no one honest `parse`/`serialize` this file could hard-code.
 * Each caller supplies its own pair, matching its own filters type exactly —
 * this file only owns the URL read/write mechanics, mirroring the same
 * "opt-in per list, no shared assumption about shape" reasoning
 * `preservePreviousResults` (`list-query.ts`) already uses for a different
 * concern.
 *
 * ## Why `useState` + two effects, not fully derived state
 *
 * A version of this hook that derived `filters` fresh from
 * `useSearchParams()` on every render (no local `useState` at all) would be
 * simpler, but it changes *when* a filter change becomes visible: today,
 * every list view's `setFilters` is a real `useState` setter, so the very
 * same render pass sees the new filters and every existing interaction test
 * in this codebase (search-on-blur, sort toggle, pagination, "resets to
 * page 1 on filter change", ...) relies on exactly that synchronous
 * re-render. Deriving from `useSearchParams()` alone would make a filter
 * change visible only once Next's router round-trips the URL update back
 * into a new `searchParams` value — invisible to a mocked router in a unit
 * test, and an extra tick even in the real app. Keeping `filters` as real
 * local state preserves that synchronous behavior unchanged; the two
 * effects below only add the URL as a second, kept-in-sync representation
 * of the same state, in both directions:
 *
 * - **State -> URL**: whenever `filters` changes, `router.replace` (never
 *   `push` — a filter change doesn't belong in browser history as its own
 *   back-button stop, mirroring how a client-side filter change never
 *   created a history entry before this hook existed either) the URL to
 *   match, skipped when it already matches (the common case: the initial
 *   render's `filters` came from `parse(searchParams)` in the first place).
 * - **URL -> state**: whenever `searchParams` changes for a reason other
 *   than the effect above (the browser's Back/Forward buttons, a
 *   still-mounted instance whose router cache restores a prior URL), and
 *   actually differs from the current `filters`, `filters` is re-hydrated
 *   from the URL. Comparing serialized strings (not object identity) is
 *   what keeps the two effects from fighting each other into a loop: each
 *   one is a no-op once the URL and `filters` already agree.
 */
export function useUrlFilters<T>(
  parse: (params: URLSearchParams) => T,
  serialize: (filters: T) => URLSearchParams,
): [T, Dispatch<SetStateAction<T>>] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<T>(() => parse(searchParams));

  // `useSearchParams()` returns a fresh object on every call in some
  // environments (this hook's own test doubles included) even when the
  // underlying query string hasn't actually changed — depending on the
  // object's identity in the effects below would make them re-run on
  // every unrelated re-render. The string form is what genuinely changed
  // or didn't.
  const searchParamsString = searchParams.toString();

  /**
   * The query string both effects below last agreed on — whichever one
   * last acted (replaced the URL, or re-hydrated `filters`) updates this
   * first. Without it, a URL change from outside this hook (Back/Forward)
   * is briefly indistinguishable from "the URL and `filters` just haven't
   * caught up with each other yet": both effects would see a mismatch on
   * the very same render and race — the state->URL effect would shove the
   * *old* filters back into the URL a tick before the URL->state effect
   * corrects `filters` to match the new URL, flashing the just-navigated-to
   * URL back to the stale one. Checking against this ref instead of each
   * other's live value means only the effect whose own input actually
   * changed since it last looked ever acts.
   */
  const lastSyncedQueryRef = useRef(searchParamsString);

  // URL -> state (Back/Forward, or a still-mounted instance whose router
  // cache restores a prior URL out from under it).
  useEffect(() => {
    if (searchParamsString === lastSyncedQueryRef.current) {
      return;
    }
    lastSyncedQueryRef.current = searchParamsString;
    setFilters(parse(searchParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsString]);

  // State -> URL.
  useEffect(() => {
    const query = serialize(filters).toString();
    if (query === lastSyncedQueryRef.current) {
      return;
    }
    lastSyncedQueryRef.current = query;
    router.replace(query ? `${pathname}?${query}` : (pathname ?? ""), { scroll: false });
    // `router`/`pathname` are stable for the lifetime of a mounted route
    // segment; re-running this only on `filters` changing is the actual
    // intent (an exhaustive-deps lint would otherwise force a spurious
    // extra replace whenever a parent re-renders with new but equivalent
    // router/pathname references).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return [filters, setFilters];
}
