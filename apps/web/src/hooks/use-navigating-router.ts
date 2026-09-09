"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { notifyNavigationStart } from "@/components/providers/navigation-overlay-listener";

/**
 * UX audit — a drop-in replacement for `next/navigation`'s `useRouter()`
 * that also reports `push()`/`replace()` calls to the global navigation
 * overlay (`NavigationOverlayListener`), so `router.push`/`router.replace`
 * call sites show the same "navigation in progress" feedback a `<Link>`
 * click already gets — without patching `history.pushState`/`replaceState`
 * (see `navigation-overlay-listener.tsx`'s own doc comment for exactly why
 * that patch turned out unreliable: Next's own App Router installs its own
 * wrapper on those same two functions).
 *
 * Call-site opt-in, not a global patch: `apps/web/src/lib/url-filters.ts`'s
 * own `router.replace()` (filter/pagination sync — pathname never changes,
 * must never show this overlay) deliberately keeps importing the plain
 * `next/navigation` `useRouter()` unchanged. Every other call site that
 * actually navigates the user to a different route imports this hook
 * instead — same return shape as the real `useRouter()` (this only wraps
 * `push`/`replace`; `back`/`forward`/`refresh`/`prefetch` pass through
 * untouched), so it's a one-line import swap, not a rewritten call site.
 *
 * `notifyNavigationStart` itself already filters out a same-pathname
 * target and resolves the "already at that route" case synchronously, so
 * there's no risk of this hook showing the overlay for a call that isn't a
 * real cross-route transition — see that function's own doc comment.
 */
export function useNavigatingRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      // Rest args + spread, deliberately, rather than a `(href, options?)`
      // signature that would always forward a second argument (even
      // `undefined`) to `router.push`/`replace` — call sites (and their
      // tests, asserting exact call shape) that pass only `href` must see
      // the real router called with exactly one argument too.
      push: (...args: Parameters<typeof router.push>) => {
        notifyNavigationStart(args[0]);
        router.push(...args);
      },
      replace: (...args: Parameters<typeof router.replace>) => {
        notifyNavigationStart(args[0]);
        router.replace(...args);
      },
    }),
    [router],
  );
}
