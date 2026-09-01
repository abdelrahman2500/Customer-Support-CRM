import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiSettingsView } from "./ai-settings-view";
import { useAiSettingsQuery, useUpdateAiSettingsMutation } from "@/hooks/use-ai-settings";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-ai-settings", () => ({
  useAiSettingsQuery: vi.fn(),
  useUpdateAiSettingsMutation: vi.fn(),
}));

const mockedUseAiSettingsQuery = vi.mocked(useAiSettingsQuery);
const mockedUseUpdateAiSettingsMutation = vi.mocked(useUpdateAiSettingsMutation);

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
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

const allEnabled = {
  summarizeEnabled: true,
  suggestReplyEnabled: true,
  categorizeEnabled: true,
  chatEnabled: true,
};

describe("AiSettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdateAiSettingsMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the settings query is pending", () => {
    mockedUseAiSettingsQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<AiSettingsView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseAiSettingsQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<AiSettingsView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("pre-fills every toggle from the existing settings", () => {
    mockedUseAiSettingsQuery.mockReturnValue(
      queryResult({
        data: { ...allEnabled, chatEnabled: false },
        isSuccess: true,
      }) as never,
    );

    render(<AiSettingsView />);

    expect(screen.getByLabelText("summarizeLabel")).toBeChecked();
    expect(screen.getByLabelText("chatLabel")).not.toBeChecked();
  });

  it("saves immediately when a toggle is changed", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockedUseAiSettingsQuery.mockReturnValue(
      queryResult({ data: allEnabled, isSuccess: true }) as never,
    );
    mockedUseUpdateAiSettingsMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<AiSettingsView />);
    fireEvent.click(screen.getByLabelText("chatLabel"));

    expect(mutateAsync).toHaveBeenCalledWith({ chatEnabled: false });
  });

  it("reverts the toggle and shows an inline error when saving fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Server error", 500));
    mockedUseAiSettingsQuery.mockReturnValue(
      queryResult({ data: allEnabled, isSuccess: true }) as never,
    );
    mockedUseUpdateAiSettingsMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<AiSettingsView />);
    fireEvent.click(screen.getByLabelText("chatLabel"));

    expect(await screen.findByText("Server error")).toBeInTheDocument();
    expect(screen.getByLabelText("chatLabel")).toBeChecked();
  });
});
