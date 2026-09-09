import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useInsertionEffect } from "react";
import { NavigationOverlayListener } from "./navigation-overlay-listener";

const mockedUsePathname = vi.fn(() => "/en/tickets");

vi.mock("next/navigation", () => ({
  usePathname: () => mockedUsePathname(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const SHOW_DELAY_MS = 150;
const FAILSAFE_TIMEOUT_MS = 10_000;

function isBusy(): boolean {
  return screen.getByRole("status").getAttribute("aria-busy") === "true";
}

/** Every listener dispatch is deferred via `queueMicrotask` (see
 * navigation-overlay-listener.tsx's own doc comment on `notify` for why —
 * synchronous dispatch can trip React's "useInsertionEffect must not
 * schedule updates" warning). `vi.useFakeTimers()` does not fake
 * microtasks, so a real microtask checkpoint is needed after any
 * `pushState`/`replaceState`/`popstate` for its effect to be observable. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

describe("NavigationOverlayListener", () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue("/en/tickets");
    // Keeps jsdom's real `window.location` in sync with the mocked
    // `usePathname()` value above — the history patch tracks its own
    // pathname starting from `window.location.pathname`, so the two must
    // agree for these tests to exercise the same comparisons production
    // does.
    window.history.pushState({}, "", "/en/tickets");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders hidden by default", () => {
    render(<NavigationOverlayListener />);

    expect(isBusy()).toBe(false);
  });

  it("does not show immediately on navigation start — only after the show-delay elapses", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/customers");
      await flushMicrotasks();
    });
    expect(isBusy()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(true);
  });

  // Case 1 — A -> B.
  it("A -> B: shows while in flight, hides once B commits", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/customers");
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(true);

    mockedUsePathname.mockReturnValue("/en/customers");
    rerender(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);
  });

  // Case 2 / Case 11 — A -> B -> C in quick succession (superseded/concurrent).
  it("A -> B -> C: a fast second navigation supersedes the first, hides once C (not B) commits", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/customers");
      await flushMicrotasks();
    });
    await act(async () => {
      // Superseded before "customers" ever committed.
      window.history.pushState({}, "", "/en/reports");
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(true);

    mockedUsePathname.mockReturnValue("/en/reports");
    rerender(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);
  });

  // Case 3 — the previously-suspected "known limitation": A -> B in flight,
  // then back to A before B commits. usePathname() would never re-fire for
  // "A" (it never actually left it — a same-value state update is a no-op
  // in React), so the pathname-diff mechanism alone genuinely cannot detect
  // this; the synchronous "destination already committed" check in the
  // listener is what resolves it instead — immediately, at click time, not
  // via the 10s failsafe, and (since it fires before the show-delay timer
  // even starts) without ever showing the overlay at all.
  it("A -> B -> A (before B commits): never shows at all — resolved synchronously, not via the failsafe", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/customers"); // A -> B
      await flushMicrotasks();
    });
    await act(async () => {
      window.history.pushState({}, "", "/en/tickets"); // back to A, B never committed
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(false);

    // Not because 10s happened to pass, either.
    act(() => {
      vi.advanceTimersByTime(FAILSAFE_TIMEOUT_MS);
    });
    expect(isBusy()).toBe(false);
  });

  // Case 4 — B redirects server-side to C (e.g. an auth guard). Next
  // reflects the final URL with its own history call before the segment
  // tree commits; this must resolve against C, not the originally-clicked B.
  it("A -> B redirects to C: hides once C commits, not stuck on B", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/customers"); // click -> B
      await flushMicrotasks();
    });
    await act(async () => {
      window.history.replaceState({}, "", "/en/login"); // server redirect -> C
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(true);

    mockedUsePathname.mockReturnValue("/en/login");
    rerender(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);
  });

  // Case 5/6 — router.push()/router.replace() firing while another
  // navigation is already in flight is exactly the pushState/replaceState
  // sequencing already covered above (both go through the same patch); this
  // spells out the replace-during-push and push-during-replace orderings
  // explicitly.
  it("a replace() while a push() is in flight resolves against the replace's destination", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/customers");
      await flushMicrotasks();
    });
    await act(async () => {
      window.history.replaceState({}, "", "/en/reports");
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });

    mockedUsePathname.mockReturnValue("/en/reports");
    rerender(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);
  });

  // Case 7 — Back/Forward. jsdom maintains a real history stack, so
  // history.back() both moves window.location and fires a real popstate,
  // exactly like a real browser.
  it("Back/Forward browser navigation shows and clears the overlay", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/customers");
      await flushMicrotasks();
    });
    mockedUsePathname.mockReturnValue("/en/customers");
    rerender(<NavigationOverlayListener />);

    await act(async () => {
      window.history.back();
      // jsdom dispatches `popstate` asynchronously (a queued task), not
      // synchronously within `back()` itself — advancing by 0ms is not
      // sufficient to flush that queued dispatch, confirmed empirically.
      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(true);

    mockedUsePathname.mockReturnValue("/en/tickets");
    rerender(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);
  });

  // Case 8 — same-pathname replace (e.g. url-filters.ts's filter/pagination
  // sync) must never trigger the overlay.
  it("does not trigger for a same-pathname replace (e.g. url-filters.ts's filter/pagination sync)", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.replaceState({}, "", "/en/tickets?status=open");
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });

    expect(isBusy()).toBe(false);
  });

  // Case 9 — a navigation that settles faster than the show-delay must
  // never flash the overlay at all.
  it("never shows for a navigation that commits before the show-delay elapses", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/customers");
      await flushMicrotasks();
    });
    // Commits well within the delay window — no timer advance at all yet.
    mockedUsePathname.mockReturnValue("/en/customers");
    rerender(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(false);
  });

  // Case 10 — a navigation that never settles at all (a genuinely failed/
  // aborted transition) is the one case the failsafe exists for.
  it("auto-clears via the failsafe timeout if a navigation never settles", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/customers");
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(FAILSAFE_TIMEOUT_MS);
    });
    expect(isBusy()).toBe(false);
  });

  it("patches window.history.pushState exactly once, even if mounted more than once", () => {
    const { unmount } = render(<NavigationOverlayListener />);
    const patchedOnce = window.history.pushState;

    unmount();
    render(<NavigationOverlayListener />);
    const patchedTwice = window.history.pushState;

    expect(patchedTwice).toBe(patchedOnce);
  });

  // Reproduces the exact runtime bug found in the browser: Next.js can call
  // pushState/replaceState from inside its own useInsertionEffect during a
  // transition. A synchronous state update scheduled from *any* component
  // while *any* insertion effect anywhere is running trips React's
  // "useInsertionEffect must not schedule updates" warning — reproduced
  // here by rendering a component that calls pushState from its own
  // useInsertionEffect, on an update (not the initial mount, when this
  // listener isn't registered yet — insertion effects fire before the
  // passive effect that registers it).
  it("does not trip React's 'useInsertionEffect must not schedule updates' warning when pushState is called from inside one", () => {
    function SimulatedInsertionEffectNavigator({ to }: { to: string }) {
      useInsertionEffect(() => {
        window.history.pushState({}, "", to);
      }, [to]);
      return null;
    }

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <>
        <NavigationOverlayListener />
        <SimulatedInsertionEffectNavigator to="/en/tickets" />
      </>,
    );
    rerender(
      <>
        <NavigationOverlayListener />
        <SimulatedInsertionEffectNavigator to="/en/customers" />
      </>,
    );

    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("useInsertionEffect must not schedule updates"),
    );
    errorSpy.mockRestore();
  });
});
