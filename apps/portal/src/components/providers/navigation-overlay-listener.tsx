"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NavigationOverlay } from "@crm/ui";

/**
 * UX audit — mirrors
 * `apps/web/src/components/providers/navigation-overlay-listener.tsx`
 * exactly (same reasoning as this app's own `auth-recovery-listener.tsx`
 * mirroring its `apps/web` counterpart) — see that file's own doc comment
 * for the full detection design: why a `pushState`/`replaceState`/
 * `popstate` patch rather than a `<Link>`-click listener, the HMR-safe
 * patch-once guard, why every listener dispatch is deferred to a microtask
 * (a synchronous dispatch can trip React's "useInsertionEffect must not
 * schedule updates" warning — Next.js calls `pushState`/`replaceState` from
 * inside one for some transitions), the try/catch dispatch hardening, how
 * completion is detected via `usePathname()`, the "destination already
 * committed" short-circuit that resolves an A -> B -> A round-trip without
 * ever touching the 10s failsafe, and the show-delay/failsafe timing. The
 * one thing genuinely specific to this app: the row-click `router.push`
 * call sites this also has to cover without an edit include
 * `ticket-list-view.tsx`, `article-list-view.tsx`, and `chat-widget.tsx`.
 */
const SHOW_DELAY_MS = 150;
const FAILSAFE_TIMEOUT_MS = 10_000;

type NavigationListener = (change: { from: string; to: string }) => void;

interface HistoryPatchState {
  listeners: Set<NavigationListener>;
}

type MarkedFunction = ((...args: never[]) => unknown) & { __navOverlay?: HistoryPatchState };

function resolvePathname(url: string | URL | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url, window.location.href).pathname;
  } catch {
    return null;
  }
}

function ensureHistoryPatched(): Set<NavigationListener> {
  const existing = (window.history.pushState as MarkedFunction).__navOverlay;
  if (existing) {
    return existing.listeners;
  }

  const listeners = new Set<NavigationListener>();
  let currentPathname = window.location.pathname;

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  function notify(nextPathname: string | null): void {
    if (nextPathname === null || nextPathname === currentPathname) {
      // Unparseable/unchanged URL, or a same-pathname update (query/hash
      // only) — not a route change, e.g. url-filters.ts's filter sync.
      return;
    }
    const from = currentPathname;
    currentPathname = nextPathname;
    listeners.forEach((listener) => {
      // Deferred to a microtask — not called synchronously here. This
      // patch runs inside whatever call stack invoked `pushState`/
      // `replaceState`/`popstate`, and Next.js's own App Router does that
      // from inside a `useInsertionEffect` for some transitions (confirmed
      // empirically: rendering a component that calls `pushState` from its
      // own `useInsertionEffect`, on an update after this patch's listener
      // is already registered, reproduces React's
      // "useInsertionEffect must not schedule updates" warning). React
      // forbids scheduling *any* state update, on *any* component, while
      // *any* insertion effect anywhere is still running — a global
      // invariant, not one scoped to this component — so a listener that
      // calls a state setter synchronously here can trip it regardless of
      // which component's insertion effect is on the stack. `queueMicrotask`
      // moves the dispatch to right after the current synchronous work
      // (including that insertion-effect commit) finishes, which is
      // functionally instantaneous — no delay perceptible against the
      // 150ms show-delay — while fully escaping that restricted phase.
      queueMicrotask(() => {
        try {
          listener({ from, to: nextPathname });
        } catch {
          // A bug in a listener must never break the real navigation this
          // dispatch was scheduled from.
        }
      });
    });
  }

  type PushStateArgs = Parameters<History["pushState"]>;
  type ReplaceStateArgs = Parameters<History["replaceState"]>;

  const patchedPushState = function patchedPushState(...args: PushStateArgs): void {
    notify(resolvePathname(args[2]));
    originalPushState(...args);
  };
  const patchedReplaceState = function patchedReplaceState(...args: ReplaceStateArgs): void {
    notify(resolvePathname(args[2]));
    originalReplaceState(...args);
  };

  window.history.pushState = patchedPushState;
  window.history.replaceState = patchedReplaceState;
  // Back/Forward: the browser has already moved `window.location` by the
  // time this fires, so — unlike the two patches above — there is no
  // "before" left to intercept; reading it here is the target, not the
  // origin, which is exactly what `notify`'s own `currentPathname` closure
  // supplies as `from`.
  window.addEventListener("popstate", () => {
    notify(window.location.pathname);
  });

  (patchedPushState as unknown as MarkedFunction).__navOverlay = { listeners };
  return listeners;
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

  useEffect(() => {
    const listeners = ensureHistoryPatched();
    const listener: NavigationListener = ({ from, to }) => {
      // The one case the pathname-diff effect below structurally cannot
      // detect on its own: a navigation whose destination is already the
      // committed route — e.g. A -> B -> A before B ever committed. React
      // never re-fires `usePathname()` for a value it already holds (a
      // no-op state update triggers no re-render), so there is no "it
      // changed" signal to wait for; the only correct answer is to resolve
      // this right here, one microtask tick after the triggering
      // `pushState`/`replaceState`/`popstate`, well before the show-delay
      // timer would ever fire, rather than let it sit pending until the
      // failsafe.
      if (to === committedPathnameRef.current) {
        pendingSincePathnameRef.current = null;
        setPending(false);
        return;
      }
      pendingSincePathnameRef.current = from;
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
