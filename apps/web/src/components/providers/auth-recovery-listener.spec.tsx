import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";
import { AuthRecoveryListener } from "./auth-recovery-listener";
import { emitAuthExpired } from "@/lib/auth-events";
import { clearQueryCache } from "@/lib/query-client-registry";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/query-client-registry", () => ({
  clearQueryCache: vi.fn(),
}));

const mockedClearQueryCache = vi.mocked(clearQueryCache);

describe("AuthRecoveryListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing", () => {
    const { container } = render(<AuthRecoveryListener />);

    expect(container).toBeEmptyDOMElement();
  });

  it("clears the query cache and replaces the current entry with the login route on an auth-expired event", () => {
    render(<AuthRecoveryListener />);

    act(() => {
      emitAuthExpired();
    });

    expect(mockedClearQueryCache).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/en/login?reason=session-expired");
  });

  it("stops reacting to the event once unmounted", () => {
    const { unmount } = render(<AuthRecoveryListener />);
    unmount();

    act(() => {
      emitAuthExpired();
    });

    expect(mockedClearQueryCache).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
