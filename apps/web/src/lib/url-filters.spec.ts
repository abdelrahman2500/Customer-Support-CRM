import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUrlFilters } from "./url-filters";

const replace = vi.fn();
let searchParamsString = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/en/tickets",
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

interface TestFilters {
  status?: string;
  page?: number;
}

function parse(params: URLSearchParams): TestFilters {
  const status = params.get("status");
  const page = params.get("page");
  return {
    ...(status ? { status } : {}),
    ...(page ? { page: Number(page) } : {}),
  };
}

function serialize(filters: TestFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));
  return params;
}

describe("useUrlFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsString = "";
  });

  it("initializes filters by parsing the current URL's query string", () => {
    searchParamsString = "status=OPEN&page=2";

    const { result } = renderHook(() => useUrlFilters(parse, serialize));

    expect(result.current[0]).toEqual({ status: "OPEN", page: 2 });
  });

  it("starts with empty filters when the URL carries no query string", () => {
    const { result } = renderHook(() => useUrlFilters(parse, serialize));

    expect(result.current[0]).toEqual({});
  });

  it("updates filters synchronously, exactly like a plain useState setter", () => {
    const { result } = renderHook(() => useUrlFilters(parse, serialize));

    act(() => {
      result.current[1]({ status: "OPEN" });
    });

    expect(result.current[0]).toEqual({ status: "OPEN" });
  });

  it("supports a functional updater reading the current filters", () => {
    searchParamsString = "status=OPEN";

    const { result } = renderHook(() => useUrlFilters(parse, serialize));

    act(() => {
      result.current[1]((current) => ({ ...current, page: 3 }));
    });

    expect(result.current[0]).toEqual({ status: "OPEN", page: 3 });
  });

  it("replaces the URL (not push) with the serialized filters after a state change", () => {
    const { result } = renderHook(() => useUrlFilters(parse, serialize));

    act(() => {
      result.current[1]({ status: "OPEN" });
    });

    expect(replace).toHaveBeenCalledWith("/en/tickets?status=OPEN", { scroll: false });
  });

  it("replaces with the bare pathname (no '?') once every filter clears", () => {
    searchParamsString = "status=OPEN";

    const { result } = renderHook(() => useUrlFilters(parse, serialize));

    act(() => {
      result.current[1]({});
    });

    expect(replace).toHaveBeenCalledWith("/en/tickets", { scroll: false });
  });

  it("never scrolls the page on a filter/page update", () => {
    const { result } = renderHook(() => useUrlFilters(parse, serialize));

    act(() => {
      result.current[1]({ page: 2 });
    });

    expect(replace).toHaveBeenCalledWith(expect.any(String), { scroll: false });
  });

  it("does not call replace when the URL already matches the initial filters", () => {
    searchParamsString = "status=OPEN";

    renderHook(() => useUrlFilters(parse, serialize));

    expect(replace).not.toHaveBeenCalled();
  });

  // The "Back/Forward button" case: the URL changes for a reason other than
  // this hook's own `setFilters` — simulated here by re-rendering with a
  // different `searchParams` return value, mirroring how `useSearchParams()`
  // itself would return a new value after a real navigation.
  it("re-hydrates filters from the URL when it changes out from under the component", () => {
    const { result, rerender } = renderHook(() => useUrlFilters(parse, serialize));

    act(() => {
      result.current[1]({ status: "OPEN" });
    });
    replace.mockClear();

    searchParamsString = "status=RESOLVED";
    rerender();

    expect(result.current[0]).toEqual({ status: "RESOLVED" });
    // Re-hydrating FROM the URL must not immediately replace it again.
    expect(replace).not.toHaveBeenCalled();
  });
});
