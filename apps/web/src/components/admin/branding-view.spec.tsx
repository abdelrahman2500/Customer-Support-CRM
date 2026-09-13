import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BrandingView } from "./branding-view";
import { useBrandingQuery, useUpdateBrandingMutation } from "@/hooks/use-branding";
import { ApiError } from "@/lib/api";
import type { BrandingSummary } from "@/lib/branding-api";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-branding", () => ({
  useBrandingQuery: vi.fn(),
  useUpdateBrandingMutation: vi.fn(),
}));

const mockedUseBrandingQuery = vi.mocked(useBrandingQuery);
const mockedUseUpdateBrandingMutation = vi.mocked(useUpdateBrandingMutation);

/** Story 129 — `BrandingSummary` gained `appName`/`navigationLayout`, so
 * every fixture below declares the full shape. Both default to `null` —
 * the unconfigured branch every pre-Story-129 case already assumed. */
function branding(overrides: Partial<BrandingSummary> = {}): BrandingSummary {
  return {
    appName: null,
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    navigationLayout: null,
    ...overrides,
  };
}

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
        data: branding({ logoUrl: "https://example.com/logo.png", primaryColor: "#112233" }),
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
        data: branding(),
        isSuccess: true,
      }) as never,
    );

    render(<BrandingView />);

    expect(screen.getByText("noLogo")).toBeInTheDocument();
  });

  it("renders a logo preview image once a logo URL is typed", () => {
    mockedUseBrandingQuery.mockReturnValue(
      queryResult({
        data: branding(),
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
        data: branding(),
        isSuccess: true,
      }) as never,
    );
    mockedUseUpdateBrandingMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<BrandingView />);

    fireEvent.change(screen.getByLabelText("primaryColorLabel"), {
      target: { value: "#abcabc" },
    });
    fireEvent.click(screen.getByText("save"));

    expect(mutateAsync).toHaveBeenCalledWith({
      primaryColor: "#abcabc",
      navigationLayout: "NAVBAR",
    });
  });

  it("shows the generic fallback, not the raw 500 body, when saving fails", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("stack trace-ish internals", 500));
    mockedUseBrandingQuery.mockReturnValue(
      queryResult({
        data: branding(),
        isSuccess: true,
      }) as never,
    );
    mockedUseUpdateBrandingMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<BrandingView />);

    fireEvent.change(screen.getByLabelText("primaryColorLabel"), {
      target: { value: "#abcabc" },
    });
    fireEvent.click(screen.getByText("save"));

    // Batch 1 (UX audit) — an unexpected 500's message must never reach the
    // screen verbatim; only the feature's own generic, translated copy may.
    expect(await screen.findByText("saveFailed")).toBeInTheDocument();
    expect(screen.queryByText("stack trace-ish internals")).not.toBeInTheDocument();
  });

  it("shows the shared forbidden text for a 403 save failure", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError("Forbidden", 403));
    mockedUseBrandingQuery.mockReturnValue(
      queryResult({
        data: branding(),
        isSuccess: true,
      }) as never,
    );
    mockedUseUpdateBrandingMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

    render(<BrandingView />);

    fireEvent.change(screen.getByLabelText("primaryColorLabel"), {
      target: { value: "#abcabc" },
    });
    fireEvent.click(screen.getByText("save"));

    expect(await screen.findByText("saveForbidden")).toBeInTheDocument();
  });

  // Story 129 — Admin Branding & Navigation Layout Customization. The new
  // fields join the existing form, and the existing loading / error /
  // success / forbidden cases above still cover them for free.
  describe("application name (Story 129)", () => {
    it("pre-fills the app-name input from the existing branding config", () => {
      mockedUseBrandingQuery.mockReturnValue(
        queryResult({ data: branding({ appName: "Acme Support" }), isSuccess: true }) as never,
      );

      render(<BrandingView />);

      expect(screen.getByLabelText("appNameLabel")).toHaveValue("Acme Support");
    });

    it("caps the input at the 60 characters the DTO's own MaxLength enforces", () => {
      mockedUseBrandingQuery.mockReturnValue(
        queryResult({ data: branding(), isSuccess: true }) as never,
      );

      render(<BrandingView />);

      expect(screen.getByLabelText("appNameLabel")).toHaveAttribute("maxlength", "60");
    });

    it("submits the typed app name", () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      mockedUseBrandingQuery.mockReturnValue(
        queryResult({ data: branding(), isSuccess: true }) as never,
      );
      mockedUseUpdateBrandingMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

      render(<BrandingView />);

      fireEvent.change(screen.getByLabelText("appNameLabel"), {
        target: { value: "Acme Support" },
      });
      fireEvent.click(screen.getByText("save"));

      expect(mutateAsync).toHaveBeenCalledWith({
        appName: "Acme Support",
        navigationLayout: "NAVBAR",
      });
    });

    it("shows the resolved brand name in the preview, falling back to the default when empty", () => {
      mockedUseBrandingQuery.mockReturnValue(
        queryResult({ data: branding(), isSuccess: true }) as never,
      );

      render(<BrandingView />);

      expect(screen.getByText("previewBrandName")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("appNameLabel"), {
        target: { value: "Acme Support" },
      });

      expect(screen.getByText("Acme Support")).toBeInTheDocument();
      expect(screen.queryByText("previewBrandName")).not.toBeInTheDocument();
    });
  });

  describe("navigation layout (Story 129)", () => {
    it("renders both options, with the branch's current one checked", () => {
      mockedUseBrandingQuery.mockReturnValue(
        queryResult({
          data: branding({ navigationLayout: "SIDEBAR" }),
          isSuccess: true,
        }) as never,
      );

      render(<BrandingView />);

      expect(screen.getByRole("radio", { name: /navigationLayout.sidebar/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /navigationLayout.navbar/ })).not.toBeChecked();
    });

    // An unconfigured branch is already rendering the navbar, so that is
    // what the form must show it as — the same single resolution point
    // (`resolveNavigationLayout`) the shell uses.
    it("shows an unconfigured branch as Navbar, not as an unselected group", () => {
      mockedUseBrandingQuery.mockReturnValue(
        queryResult({ data: branding({ navigationLayout: null }), isSuccess: true }) as never,
      );

      render(<BrandingView />);

      expect(screen.getByRole("radio", { name: /navigationLayout.navbar/ })).toBeChecked();
    });

    it("sends the newly selected layout on save", () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      mockedUseBrandingQuery.mockReturnValue(
        queryResult({ data: branding(), isSuccess: true }) as never,
      );
      mockedUseUpdateBrandingMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

      render(<BrandingView />);

      fireEvent.click(screen.getByRole("radio", { name: /navigationLayout.sidebar/ }));
      fireEvent.click(screen.getByText("save"));

      expect(mutateAsync).toHaveBeenCalledWith({ navigationLayout: "SIDEBAR" });
    });

    // Always sent, unlike the four optional text fields: omitting it would
    // make "switch back to Navbar" a silent no-op against the upsert.
    it("still sends the layout when switching back to Navbar", () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      mockedUseBrandingQuery.mockReturnValue(
        queryResult({
          data: branding({ navigationLayout: "SIDEBAR" }),
          isSuccess: true,
        }) as never,
      );
      mockedUseUpdateBrandingMutation.mockReturnValue(mutationResult({ mutateAsync }) as never);

      render(<BrandingView />);

      fireEvent.click(screen.getByRole("radio", { name: /navigationLayout.navbar/ }));
      fireEvent.click(screen.getByText("save"));

      expect(mutateAsync).toHaveBeenCalledWith({ navigationLayout: "NAVBAR" });
    });

    it("groups both options under a single labelled fieldset", () => {
      mockedUseBrandingQuery.mockReturnValue(
        queryResult({ data: branding(), isSuccess: true }) as never,
      );

      render(<BrandingView />);

      const group = screen.getByRole("group", { name: "navigationLayoutLegend" });
      expect(within(group).getAllByRole("radio")).toHaveLength(2);
    });
  });
});
