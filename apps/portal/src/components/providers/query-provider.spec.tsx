import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryProvider } from "./query-provider";
import { registerQueryClient } from "@/lib/query-client-registry";

vi.mock("@/lib/query-client-registry", () => ({
  registerQueryClient: vi.fn(),
}));

// Story 95 — see apps/web's own query-provider.spec.tsx for why this is mocked.
vi.mock("./auth-recovery-listener", () => ({
  AuthRecoveryListener: () => null,
}));

describe("QueryProvider (portal)", () => {
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
