import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNavigatingRouter } from "./use-navigating-router";

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back }),
}));

const notifyNavigationStart = vi.fn();
vi.mock("@/components/providers/navigation-overlay-listener", () => ({
  notifyNavigationStart: (...args: unknown[]) => notifyNavigationStart(...args),
}));

describe("useNavigatingRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls through to the real router.push with the exact arguments given, unchanged", () => {
    const { result } = renderHook(() => useNavigatingRouter());

    result.current.push("/en/tickets");

    expect(push).toHaveBeenCalledWith("/en/tickets");
    expect(push).toHaveBeenCalledOnce();
  });

  it("forwards push's second argument (scroll options) only when the caller actually passes one", () => {
    const { result } = renderHook(() => useNavigatingRouter());

    result.current.push("/en/tickets", { scroll: false });

    expect(push).toHaveBeenCalledWith("/en/tickets", { scroll: false });
  });

  it("calls through to the real router.replace with the exact arguments given, unchanged", () => {
    const { result } = renderHook(() => useNavigatingRouter());

    result.current.replace("/en/login?reason=session-expired");

    expect(replace).toHaveBeenCalledWith("/en/login?reason=session-expired");
  });

  it("reports push() to the navigation overlay before delegating", () => {
    const { result } = renderHook(() => useNavigatingRouter());

    result.current.push("/en/tickets");

    expect(notifyNavigationStart).toHaveBeenCalledWith("/en/tickets");
  });

  it("reports replace() to the navigation overlay before delegating", () => {
    const { result } = renderHook(() => useNavigatingRouter());

    result.current.replace("/en/login");

    expect(notifyNavigationStart).toHaveBeenCalledWith("/en/login");
  });

  it("passes through every other real router method (back/forward/refresh/prefetch) untouched", () => {
    const { result } = renderHook(() => useNavigatingRouter());

    result.current.back();

    expect(back).toHaveBeenCalledOnce();
    expect(notifyNavigationStart).not.toHaveBeenCalled();
  });
});
