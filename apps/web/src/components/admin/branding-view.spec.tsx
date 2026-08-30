import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrandingView } from "./branding-view";
import { useBrandingQuery, useUpdateBrandingMutation } from "@/hooks/use-branding";
import { ApiError } from "@/lib/api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-branding", () => ({
  useBrandingQuery: vi.fn(),
  useUpdateBrandingMutation: vi.fn(),
}));

const mockedUseBrandingQuery = vi.mocked(useBrandingQuery);
const mockedUseUpdateBrandingMutation = vi.mocked(useUpdateBrandingMutation);

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

describe("BrandingView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUpdateBrandingMutation.mockReturnValue(mutationResult() as never);
  });

  it("shows a loading state while the branding query is pending", () => {
    mockedUseBrandingQuery.mockReturnValue(queryResult({ isLoading: true }) as never);

    const { container } = render(<BrandingView />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows a generic error state with a retry action", () => {
    const refetch = vi.fn();
    mockedUseBrandingQuery.mockReturnValue(queryResult({ isError: true, refetch }) as never);

    render(<BrandingView />);

    expect(screen.getByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("pre-fills the form from the existing branding config", () => {
    mockedUseBrandingQuery.mockReturnValue(
      queryResult({
        data: { logoUrl: "https://example.com/logo.png", primaryColor: "#112233", secondaryColor: null },
        isSuccess: true,
      }) as never,
    );

    render(<BrandingView />);

    expect(screen.getByDisplayValue("https://example.com/logo.png")).toBeInTheDocument();
    expect(screen.getByDisplayValue("#112233")).toBeInTheDocument();
  });

  it("shows the no-logo placeholder in the preview when no logo is set", () => {
    mockedUseBrandingQuery.mockReturnValue(
      queryResult({
        data: { logoUrl: null, primaryColor: null, secondaryColor: null },
        isSuccess: true,
      }) as never,
    );

    render(<BrandingView />);

    expect(screen.getByText("noLogo")).toBeInTheDocument();
  });

  it("renders a logo preview image once a logo URL is typed", () => {
    mockedUseBrandingQuery.mockReturnValue(
      queryResult({
        data: { logoUrl: null, primaryColor: null, secondaryColor: null },
        isSuccess: true,
      }) as never,
    );

    render(<BrandingView />);

    fireEvent.change(screen.getByLabelText("logoUrlLabel"), {
      target: { value: "https://example.com/new-logo.png" },
    });

    expect(screen.getByAltText("logoPreviewAlt")).toHaveAttribute(
      "src",
      "https://example.com/new-logo.png",
    );
    expect(screen.queryByText("noLogo")).not.toBeInTheDocument();
  });

  it("saves the form via the update mutation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    mockedUseBrandingQuery.mockReturnValue(
      queryResult({
        data: { logoUrl: null, primaryColor: null, secondaryColor: null },
        isSuccess: true,
      }) as never,
    );
    mockedUseUpdateBrandingMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<BrandingView />);

    fireEvent.change(screen.getByLabelText("primaryColorLabel"), {
      target: { value: "#abcabc" },
    });
    fireEvent.click(screen.getByText("save"));

    expect(mutateAsync).toHaveBeenCalledWith({ primaryColor: "#abcabc" });
  });

  it("shows an inline error when saving fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Server error", 500));
    mockedUseBrandingQuery.mockReturnValue(
      queryResult({
        data: { logoUrl: null, primaryColor: null, secondaryColor: null },
        isSuccess: true,
      }) as never,
    );
    mockedUseUpdateBrandingMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<BrandingView />);

    fireEvent.change(screen.getByLabelText("primaryColorLabel"), {
      target: { value: "#abcabc" },
    });
    fireEvent.click(screen.getByText("save"));

    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });
});
