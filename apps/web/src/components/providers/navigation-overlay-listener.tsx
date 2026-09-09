"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NavigationOverlay } from "@crm/ui";

/**
 * UX audit — the global route-navigation overlay's detection half (the
 * visual half is `NavigationOverlay`, `@crm/ui`).
 *
 * Deliberately separate from:
 *   - `loading.tsx` (per-route Suspense fallback, shaped like the page it
 *     replaces) — both can be on screen during the same transition.
 *   - Button pending state (`Button`'s own `isLoading`) — an action/submit
 *     signal, unrelated to whether the URL itself is changing.
 *   - React Query's `isFetching` (`FetchingIndicator`) — background data
 *     refresh, not a route change.
 *
 * ## Detecting navigation start — NOT via patching history.pushState/replaceState
 *
 * An earlier version of this file patched `window.history.pushState`/
 * `replaceState` to observe every soft navigation in one place. Manual
 * browser verification (not just unit tests) found that mechanism silently
 * non-functional: Next.js's own App Router *also* installs its own wrapper
 * on `window.history.pushState`/`replaceState` (confirmed directly —
 * `window.history.pushState.toString()` in a running page shows Next's own
 * minified function, checking its internal `__NA`/`_N` markers, not ours,
 * and carrying none of our marker state). Whichever of the two patches
 * "wins" is an implementation-order accident, not something this file can
 * control — in practice Next's own patch ends up the one actually
 * installed, so our wrapper (and therefore every `notify()` call inside
 * it) never ran for *any* real `<Link>` or `router.push()`/`replace()`
 * navigation. This is exactly the risk of patching a global browser API a
 * framework also patches: don't rely on winning that race.
 *
 * The fix does not touch `history.pushState`/`replaceState` at all:
 *
 *   - **`<Link>` clicks**: a single `click` listener on `document`, in the
 *     *bubble* phase (the default — deliberately not capture). Next's own
 *     `<Link>` click handler runs first (it's attached directly on the
 *     anchor, which is lower in the tree and therefore reached earlier in
 *     bubbling) and calls `event.preventDefault()` exactly when it decides
 *     to take over navigation itself — an *unmodified* click on a
 *     same-origin link it recognizes as internal. That's the one existing,
 *     always-true signal "a soft navigation is starting" already carries,
 *     so this listener only acts when `event.defaultPrevented` is already
 *     `true` by the time it sees the event — it never has to reimplement
 *     Next's own modifier-key/target=_blank/download-attribute rules,
 *     because Next already didn't call `preventDefault()` for any of
 *     those, and this listener simply does nothing when it wasn't.
 *   - **`router.push()`/`router.replace()`**: `useNavigatingRouter`
 *     (`@/hooks/use-navigating-router`) wraps `next/navigation`'s
 *     `useRouter()`, calling `notifyNavigationStart` before delegating to
 *     the real method. Deliberately a call-site opt-in, not another global
 *     patch: `apps/web/src/lib/url-filters.ts`'s own `router.replace()`
 *     (filter/pagination sync, must never show this overlay) keeps using
 *     the plain `next/navigation` `useRouter()` unchanged, and every other
 *     call site (recon: 13 across `apps/web/src`, e.g.
 *     `ticket-list-view.tsx`'s row-click navigation, `workspace-nav.tsx`'s
 *     sign-out/locale-switch, `login/page.tsx`) imports the wrapped hook
 *     instead — a one-line import change per file, no logic changed at any
 *     of them.
 *   - **Back/Forward**: the `popstate` *event* — a plain `addEventListener`
 *     subscription, not a patched function. Multiple listeners coexist on
 *     the same event with no possibility of one silently replacing
 *     another, which is exactly the property `pushState`/`replaceState`
 *     turned out not to have.
 *
 * `notifyNavigationStart(href)` resolves `href` to a pathname and, same as
 * before, filters out a same-pathname target (`url-filters.ts`-style
 * query/hash-only updates) before ever reaching a listener. Each dispatch
 * is deferred to a microtask (`queueMicrotask`) and wrapped in try/catch —
 * kept from the previous version even though neither a `click` handler nor
 * an application call site normally runs inside a `useInsertionEffect`
 * (the one call pattern that previously required it): cheap insurance
 * against a future caller that does, and a bug in one listener still must
 * never break the real navigation this call is guarding.
 *
 * ## Detecting navigation completion — unchanged
 *
 * `usePathname()` only updates once React actually commits the destination
 * route's segment tree — i.e. after its RSC payload (including any async
 * Server Component data, like `(agent)/layout.tsx`'s `fetchCurrentUser()`)
 * has arrived. A `useEffect` keyed on `usePathname()` clears the flag the
 * moment the committed pathname differs from the pathname recorded when
 * the flag was last set (`pendingSincePathnameRef`, refreshed on every
 * notification, not just the first, so a redirect chain resolves against
 * whatever the *final* committed pathname turns out to be).
 *
 * That pathname-diff check has one structural blind spot: it cannot detect
 * a navigation whose destination is the route *already committed* — e.g.
 * `A -> B -> A`, back to the exact starting route, before `B` ever
 * committed. React does not re-fire `usePathname()` for a value it already
 * holds — a same-value state update is a no-op, so there is no "it
 * changed" event to ever wait for in that case. `committedPathnameRef`
 * (kept fresh from `usePathname()` regardless of `pending`) is compared
 * directly inside the listener itself: if a notification's destination
 * already equals it, the flag clears right there, one microtask tick after
 * the triggering click/`router.push`/`popstate`, well before the
 * show-delay timer would ever fire — rather than falling through to
 * "pending, waiting for a commit that will never arrive as a distinct
 * value."
 *
 * A ~150ms show-delay avoids flashing the backdrop for an instant/cached
 * transition. The 10s failsafe exists only for a transition that
 * genuinely never resolves by either mechanism at all (an aborted/failed
 * fetch that leaves both the URL and the rendered route in an inconsistent
 * state) — it is not, and must never become, the normal path for an
 * ordinary navigation.
 */
const SHOW_DELAY_MS = 150;
const FAILSAFE_TIMEOUT_MS = 10_000;

type NavigationListener = (to: string) => void;

const listeners = new Set<NavigationListener>();

function resolvePathname(href: string): string | null {
  try {
    return new URL(href, window.location.href).pathname;
  } catch {
    return null;
  }
}

/**
 * Notifies every mounted `NavigationOverlayListener` that a client-side
 * navigation to `href` is starting. Called from this file's own `click`
 * listener (`<Link>`s) and from `useNavigatingRouter` (`router.push()`/
 * `replace()`) — see this file's own doc comment for why neither goes
 * through `history.pushState`/`replaceState`.
 */
export function notifyNavigationStart(href: string): void {
  const pathname = resolvePathname(href);
  if (pathname === null) {
    return;
  }
  listeners.forEach((listener) => {
    queueMicrotask(() => {
      try {
        listener(pathname);
      } catch {
        // A bug in a listener must never break the real navigation this
        // call is guarding.
      }
    });
  });
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function findNavigableAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest("a[href]");
}

function installLinkClickListener(): () => void {
  function handleClick(event: MouseEvent): void {
    // Bubble phase (this function's own registration below, not capture):
    // by the time a `document`-level bubble listener sees the event,
    // Next's own `<Link>` click handler (attached lower in the tree, on
    // the anchor itself) has already run and already called
    // `preventDefault()` if and only if it decided to take over — the one
    // reliable "a soft navigation is starting" signal available here.
    if (!event.defaultPrevented || !isPlainLeftClick(event)) {
      return;
    }
    const anchor = findNavigableAnchor(event.target);
    if (!anchor || (anchor.target && anchor.target !== "_self")) {
      return;
    }
    notifyNavigationStart(anchor.href);
  }
  document.addEventListener("click", handleClick);
  return () => document.removeEventListener("click", handleClick);
}

export function NavigationOverlayListener() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  const pendingSincePathnameRef = useRef<string | null>(null);
  // Always the last pathname `usePathname()` actually reported — kept fresh
  // by the effect below regardless of `pending`, so the listener always has
  // an up-to-date answer to "is this destination already what's rendered?"
  // without waiting for a render of its own.
  const committedPathnameRef = useRef(pathname);
  useEffect(() => {
    committedPathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => installLinkClickListener(), []);

  useEffect(() => {
    function handlePopState(): void {
      // Back/Forward: the browser has already moved `window.location` by
      // the time this fires, so the target is simply wherever we are now.
      notifyNavigationStart(window.location.pathname);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const listener: NavigationListener = (to) => {
      // The one case the pathname-diff effect below structurally cannot
      // detect on its own: a navigation whose destination is already the
      // committed route — e.g. A -> B -> A before B ever committed. See
      // this file's own doc comment.
      if (to === committedPathnameRef.current) {
        pendingSincePathnameRef.current = null;
        setPending(false);
        return;
      }
      pendingSincePathnameRef.current = committedPathnameRef.current;
      setPending(true);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (pending && pendingSincePathnameRef.current !== null && pathname !== pendingSincePathnameRef.current) {
      pendingSincePathnameRef.current = null;
      setPending(false);
    }
  }, [pathname, pending]);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    const failsafeTimer = setTimeout(() => {
      pendingSincePathnameRef.current = null;
      setPending(false);
    }, FAILSAFE_TIMEOUT_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(failsafeTimer);
    };
  }, [pending]);

  return <NavigationOverlay visible={visible} label={t("loading")} />;
}
