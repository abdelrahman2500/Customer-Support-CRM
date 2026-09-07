import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ApiKeysView } from "./api-keys-view";
import { useApiKeysQuery, useCreateApiKeyMutation, useRevokeApiKeyMutation } from "@/hooks/use-api-keys";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useApiKeysQuery: vi.fn(),
  useCreateApiKeyMutation: vi.fn(),
  useRevokeApiKeyMutation: vi.fn(),
}));

const mockedUseApiKeysQuery = vi.mocked(useApiKeysQuery);
const mockedUseCreateApiKeyMutation = vi.mocked(useCreateApiKeyMutation);
const mockedUseRevokeApiKeyMutation = vi.mocked(useRevokeApiKeyMutation);

function queryResult(overrides: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function mutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

const ACTIVE_KEY = {
  id: "key-1",
  label: "CI bot",
  keyPrefix: "crmk_ab",
  scopes: ["integration:read"],
  expiresAt: null,
  revokedAt: null,
  createdByUserId: "user-1",
  lastUsedAt: null,
  createdAt: "2024-01-01T00:00:00.000Z",
};

describe("ApiKeysView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreateApiKeyMutation.mockReturnValue(mutationResult() as never);
    mockedUseRevokeApiKeyMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the keys query is pending", () => {
    mockedUseApiKeysQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<ApiKeysView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseApiKeysQuery.mockReturnValue(
      queryResult({ isError: true, error: new ApiError("Server error", 500), refetch }) as never,
    );

    render(<ApiKeysView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are no keys yet", () => {
    mockedUseApiKeysQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<ApiKeysView />);

    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("renders a key's label, prefix, scopes, and active status", () => {
    mockedUseApiKeysQuery.mockReturnValue(queryResult({ data: [ACTIVE_KEY], isSuccess: true }) as never);

    render(<ApiKeysView />);

    expect(screen.getByText("CI bot")).toBeInTheDocument();
    expect(screen.getByText("crmk_ab…")).toBeInTheDocument();
    expect(screen.getAllByText("integration:read").length).toBeGreaterThan(0);
    expect(screen.getByText("status.active")).toBeInTheDocument();
  });

  it("shows a revoked key as revoked and disables its own revoke button", () => {
    mockedUseApiKeysQuery.mockReturnValue(
      queryResult({
        data: [{ ...ACTIVE_KEY, revokedAt: "2024-06-01T00:00:00.000Z" }],
        isSuccess: true,
      }) as never,
    );

    render(<ApiKeysView />);

    expect(screen.getByText("status.revoked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "revoke" })).toBeDisabled();
  });

  it("shows an expired key as expired", () => {
    mockedUseApiKeysQuery.mockReturnValue(
      queryResult({
        data: [{ ...ACTIVE_KEY, expiresAt: "2020-01-01T00:00:00.000Z" }],
        isSuccess: true,
      }) as never,
    );

    render(<ApiKeysView />);

    expect(screen.getByText("status.expired")).toBeInTheDocument();
  });

  it("does not revoke immediately — clicking revoke opens a confirmation dialog first", () => {
    const mutate = vi.fn();
    mockedUseApiKeysQuery.mockReturnValue(queryResult({ data: [ACTIVE_KEY], isSuccess: true }) as never);
    mockedUseRevokeApiKeyMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<ApiKeysView />);

    fireEvent.click(screen.getByRole("button", { name: "revoke" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("revokes the key via the confirmation dialog", () => {
    const mutate = vi.fn();
    mockedUseApiKeysQuery.mockReturnValue(queryResult({ data: [ACTIVE_KEY], isSuccess: true }) as never);
    mockedUseRevokeApiKeyMutation.mockReturnValue(mutationResult({ mutate }) as never);

    render(<ApiKeysView />);

    fireEvent.click(screen.getByRole("button", { name: "revoke" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "revoke" }));

    expect(mutate).toHaveBeenCalledWith("key-1", expect.objectContaining({ onSuccess: expect.any(Function) }));
  });

  it("disables the create-key submit button until a label and at least one scope are chosen", () => {
    mockedUseApiKeysQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);

    render(<ApiKeysView />);

    expect(screen.getByText("createSubmit").closest("button")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("labelLabel"), { target: { value: "CI bot" } });
    expect(screen.getByText("createSubmit").closest("button")).toBeDisabled();

    fireEvent.click(screen.getByLabelText("integration:read"));
    expect(screen.getByText("createSubmit").closest("button")).not.toBeDisabled();
  });

  it("submits the chosen label and scopes, then reveals the one-time raw key", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ...ACTIVE_KEY, rawKey: "crmk_generated-secret" });
    mockedUseApiKeysQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseCreateApiKeyMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<ApiKeysView />);

    fireEvent.change(screen.getByLabelText("labelLabel"), { target: { value: "CI bot" } });
    fireEvent.click(screen.getByLabelText("integration:read"));
    fireEvent.submit(screen.getByText("createSubmit").closest("form") as HTMLFormElement);

    await vi.waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ label: "CI bot", scopes: ["integration:read"] });
    });
    expect(await screen.findByText("crmk_generated-secret")).toBeInTheDocument();
  });

  it("shows a generic create-failed message when creation fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Server error", 500));
    mockedUseApiKeysQuery.mockReturnValue(queryResult({ data: [], isSuccess: true }) as never);
    mockedUseCreateApiKeyMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<ApiKeysView />);

    fireEvent.change(screen.getByLabelText("labelLabel"), { target: { value: "CI bot" } });
    fireEvent.click(screen.getByLabelText("integration:read"));
    fireEvent.submit(screen.getByText("createSubmit").closest("form") as HTMLFormElement);

    expect(await screen.findByText("createFailed")).toBeInTheDocument();
  });
});
