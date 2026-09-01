import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryProvider } from "./query-provider";
import { registerQueryClient } from "@/lib/query-client-registry";

vi.mock("@/lib/query-client-registry", () => ({
  registerQueryClient: vi.fn(),
}));

// Story 95 — Authentication Recovery. AuthRecoveryListener needs a real
// router/params context this test doesn't set up; it renders nothing in
// production and is covered by its own dedicated spec, so it's mocked out
// here to keep this file focused on QueryProvider's own responsibilities.
vi.mock("./auth-recovery-listener", () => ({
  AuthRecoveryListener: () => null,
}));

describe("QueryProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders its children", () => {
    render(
      <QueryProvider>
        <span>child content</span>
      </QueryProvider>,
    );

    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("registers the query client it creates (Story 95)", () => {
    render(
      <QueryProvider>
        <span>child content</span>
      </QueryProvider>,
    );

    expect(registerQueryClient).toHaveBeenCalledOnce();
  });
});
