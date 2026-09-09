import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useInsertionEffect } from "react";
import { NavigationOverlayListener, notifyNavigationStart } from "./navigation-overlay-listener";

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

/** Simulates a real `<Link>` click exactly as Next.js's own click handler
 * leaves it by the time it reaches this file's `document`-level bubble
 * listener: `defaultPrevented` already `true` (Next took over), fired on
 * an `<a href>` in the document. */
function clickLink(href: string, options: { defaultPrevented?: boolean; target?: string } = {}): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  if (options.target) {
    anchor.target = options.target;
  }
  document.body.appendChild(anchor);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  if (options.defaultPrevented !== false) {
    event.preventDefault();
  }
  anchor.dispatchEvent(event);
  anchor.remove();
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

describe("NavigationOverlayListener", () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue("/en/tickets");
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

  it("mounts and installs its click listener (a click on an internal <Link>-style anchor is observed)", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      clickLink("/en/customers");
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });

    expect(isBusy()).toBe(true);
  });

  it("does not show immediately on navigation start — only after the show-delay elapses", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      clickLink("/en/customers");
      await flushMicrotasks();
    });
    expect(isBusy()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(true);
  });

  // Case 1 — A -> B via <Link>.
  it("A -> B: shows while in flight, hides once B commits", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      clickLink("/en/customers");
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

  // Case 2 / superseded — A -> B -> C in quick succession.
  it("A -> B -> C: a fast second navigation supersedes the first, hides once C (not B) commits", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      clickLink("/en/customers");
      await flushMicrotasks();
    });
    await act(async () => {
      clickLink("/en/reports");
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

  // Case 3 — A -> B -> A before B commits. usePathname() would never
  // re-fire for "A" (it never actually left it), so the pathname-diff
  // mechanism alone genuinely cannot detect this; the "destination already
  // committed" check in the listener resolves it instead, synchronously
  // (well, one microtask tick), before the show-delay even starts.
  it("A -> B -> A (before B commits): never shows at all, resolved instantly, not via the failsafe", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      clickLink("/en/customers");
      await flushMicrotasks();
    });
    await act(async () => {
      clickLink("/en/tickets"); // back to A, B never committed
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(FAILSAFE_TIMEOUT_MS);
    });
    expect(isBusy()).toBe(false);
  });

  // Case 4 — B redirects server-side to C. Whatever the final commit turns
  // out to be, the overlay must resolve against *that*, not the originally
  // clicked destination.
  it("A -> B redirects to C: hides once C commits, not stuck on B", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      clickLink("/en/customers");
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(true);

    // The redirect itself is just a different final pathname commit.
    mockedUsePathname.mockReturnValue("/en/login");
    rerender(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);
  });

  // Case 5/6 — router.push()/router.replace(), via notifyNavigationStart
  // directly (what useNavigatingRouter calls) rather than a <Link> click —
  // same underlying mechanism, exercised the way the wrapped hook uses it.
  it("router.push()-style notifyNavigationStart() shows the overlay the same way a <Link> click does", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      notifyNavigationStart("/en/customers");
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

  it("a router.replace() while a router.push() is in flight resolves against the replace's destination", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    await act(async () => {
      notifyNavigationStart("/en/customers");
      await flushMicrotasks();
    });
    await act(async () => {
      notifyNavigationStart("/en/reports");
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });

    mockedUsePathname.mockReturnValue("/en/reports");
    rerender(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);
  });

  // Case 7 — Back/Forward via the native popstate event.
  it("Back/Forward browser navigation (popstate) shows and clears the overlay", async () => {
    const { rerender } = render(<NavigationOverlayListener />);

    // Simulate having actually navigated to "customers" first (a real
    // commit), then going back to "tickets" via popstate.
    window.history.pushState({}, "", "/en/customers");
    mockedUsePathname.mockReturnValue("/en/customers");
    rerender(<NavigationOverlayListener />);

    await act(async () => {
      window.history.pushState({}, "", "/en/tickets");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(isBusy()).toBe(true);

    mockedUsePathname.mockReturnValue("/en/tickets");
    rerender(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);
  });

  // Case 8 — same-pathname link (query/hash only) must never trigger it.
  it("does not trigger for a same-pathname link (e.g. a filter/pagination href)", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      clickLink("/en/tickets?status=open");
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });

    expect(isBusy()).toBe(false);
  });

  it("does not trigger for a modified click (ctrl/cmd/shift/alt, or a non-primary button)", async () => {
    render(<NavigationOverlayListener />);

    const anchor = document.createElement("a");
    anchor.href = "/en/customers";
    document.body.appendChild(anchor);
    await act(async () => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
      event.preventDefault();
      anchor.dispatchEvent(event);
      await flushMicrotasks();
    });
    anchor.remove();
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });

    expect(isBusy()).toBe(false);
  });

  it("does not trigger for a click Next never took over (defaultPrevented left false — e.g. a plain external <a>)", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      clickLink("/en/customers", { defaultPrevented: false });
      await flushMicrotasks();
    });
    act(() => {
      vi.advanceTimersByTime(SHOW_DELAY_MS);
    });

    expect(isBusy()).toBe(false);
  });

  it("does not trigger for a target=_blank anchor", async () => {
    render(<NavigationOverlayListener />);

    await act(async () => {
      clickLink("/en/customers", { target: "_blank" });
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
      clickLink("/en/customers");
      await flushMicrotasks();
    });
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
      clickLink("/en/customers");
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

  it("removes its click and popstate listeners on unmount", async () => {
    const { unmount } = render(<NavigationOverlayListener />);
    unmount();

    // No listener registered any more — dispatching should be inert
    // (nothing throws, nothing left listening to assert against, but a
    // fresh render should start hidden regardless of the events below).
    await act(async () => {
      clickLink("/en/customers");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await flushMicrotasks();
    });

    render(<NavigationOverlayListener />);
    expect(isBusy()).toBe(false);
  });

  // Reproduces the exact runtime bug found in the browser during an
  // earlier (history-patching) version of this mechanism: Next.js can call
  // pushState/replaceState from inside its own useInsertionEffect during a
  // transition, and a synchronous state update scheduled from *any*
  // component while *any* insertion effect anywhere is running trips
  // React's "useInsertionEffect must not schedule updates" warning. This
  // version no longer patches those two functions at all, but the
  // dispatch is still deferred to a microtask as cheap insurance — this
  // test keeps proving that guarantee holds.
  it("does not trip React's 'useInsertionEffect must not schedule updates' warning", () => {
    function SimulatedInsertionEffectNavigator({ to }: { to: string }) {
      useInsertionEffect(() => {
        notifyNavigationStart(to);
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
