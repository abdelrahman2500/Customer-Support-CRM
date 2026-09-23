"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NavigationOverlay } from "@crm/ui";

/**
 * UX audit — the global route-navigation overlay's detection half (the
 * visual half is `NavigationOverlay`, `@crm/ui`). Mirrors
 * `apps/web/src/components/providers/navigation-overlay-listener.tsx`
 * line-for-line below this comment; read that file for the full design
 * rationale, which applies here unchanged.
 *
 * ## Story 171 — why this file was rewritten
 *
 * This app kept the ORIGINAL detection mechanism after `apps/web` replaced
 * it: a patch over `window.history.pushState`/`replaceState`. `apps/web`'s
 * own doc comment records why that was abandoned, measured in a real
 * browser rather than in tests — Next.js's App Router installs its own
 * wrapper on those same two methods, `window.history.pushState.toString()`
 * in a running page shows Next's minified function carrying none of our
 * marker state, and whichever patch "wins" is an implementation-order
 * accident. In practice Next's wins, so the wrapper never ran for any real
 * `<Link>` or `router.push()` navigation and this app's overlay never
 * appeared.
 *
 * The portal's unit tests did not catch that, and could not: they called
 * `window.history.pushState` directly, which exercises our patch in
 * isolation because no Next.js runtime is present in jsdom to install a
 * competing one. The tests were right about the code and wrong about the
 * browser.
 *
 * So this file now uses the same three mechanisms `apps/web` does, none of
 * which patch a global a framework also patches:
 *
 *   - **`<Link>` clicks** — one bubble-phase `click` listener on
 *     `document`, acting only when `event.defaultPrevented` is already true
 *     (Next's own anchor handler calls `preventDefault()` exactly when it
 *     takes over), so none of its modifier-key/target/download rules are
 *     reimplemented here.
 *   - **`router.push()`/`replace()`** — `useNavigatingRouter`
 *     (`@/hooks/use-navigating-router`), which calls
 *     `notifyNavigationStart` before delegating. Call-site opt-in, not
 *     another global patch. Unlike `apps/web`, this app has no
 *     `url-filters.ts`, so there is no same-pathname filter-sync
 *     `replace()` to exclude: all eight navigating files import the hook.
 *   - **Back/Forward** — the `popstate` *event*, a plain subscription that
 *     cannot silently replace another listener.
 *
 * Completion detection (`usePathname()`), the already-committed
 * short-circuit, the microtask dispatch, the show-delay and the failsafe are
 * all unchanged from the previous implementation and identical to
 * `apps/web`'s.
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
    if (
      pending &&
      pendingSincePathnameRef.current !== null &&
      pathname !== pendingSincePathnameRef.current
    ) {
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
