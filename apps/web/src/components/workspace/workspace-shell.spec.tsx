import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceShell } from "./workspace-shell";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useUnreadNotificationCountQuery } from "@/hooks/use-notifications";
import type { BrandingSummary } from "@/lib/branding-api";

/**
 * Story 129 — the shell's own responsibility is exactly one decision:
 * which navigation presentation this branch gets, and where `<main>` sits
 * relative to it. Both presentations and the header have their own
 * dedicated specs covering their internals, so all three are stood in for
 * here — the same treatment `settings-view.spec.tsx` gives its three
 * panels.
 */
vi.mock("@/hooks/use-branding", () => ({
  useBrandingQuery: vi.fn(),
}));

vi.mock("@/hooks/use-notifications", () => ({
  useUnreadNotificationCountQuery: vi.fn(),
}));

vi.mock("./workspace-header", () => ({
  WorkspaceHeader: () => <div>header content</div>,
}));
vi.mock("./workspace-navbar", () => ({
  WorkspaceNavbar: () => <div>navbar content</div>,
}));
vi.mock("./workspace-sidebar", () => ({
  WorkspaceSidebar: () => <div>sidebar content</div>,
}));

const mockedUseBrandingQuery = vi.mocked(useBrandingQuery);
const mockedUseUnreadNotificationCountQuery = vi.mocked(useUnreadNotificationCountQuery);

const user = {
  id: "user-1",
  email: "agent@example.com",
  fullName: "Ada Lovelace",
  branchId: "branch-1",
  departmentId: null,
  roles: ["Agent"],
  preferredLocale: null,
};

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

function renderShell(initialBranding: BrandingSummary | null = null) {
  return render(
    <WorkspaceShell user={user} initialBranding={initialBranding}>
      <p>page content</p>
    </WorkspaceShell>,
  );
}

describe("WorkspaceShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseBrandingQuery.mockReturnValue({ data: undefined } as never);
    mockedUseUnreadNotificationCountQuery.mockReturnValue({
      data: undefined,
      isSuccess: false,
    } as never);
  });

  describe("layout selection", () => {
    it("renders the navbar when the branch has configured NAVBAR", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: branding({ navigationLayout: "NAVBAR" }),
      } as never);

      renderShell();

      expect(screen.getByText("navbar content")).toBeInTheDocument();
      expect(screen.queryByText("sidebar content")).not.toBeInTheDocument();
    });

    // The backward-compatibility guarantee: every branch that existed
    // before this story has `null` here and must be unchanged.
    it("renders the navbar for an unconfigured branch (null)", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: branding({ navigationLayout: null }),
      } as never);

      renderShell();

      expect(screen.getByText("navbar content")).toBeInTheDocument();
      expect(screen.queryByText("sidebar content")).not.toBeInTheDocument();
    });

    // A branding outage degrades to the pre-Story-129 navbar; it never
    // blanks the workspace.
    it("renders the navbar when the branding query has no data at all", () => {
      mockedUseBrandingQuery.mockReturnValue({ data: undefined } as never);

      renderShell();

      expect(screen.getByText("navbar content")).toBeInTheDocument();
      expect(screen.queryByText("sidebar content")).not.toBeInTheDocument();
    });

    it("renders the sidebar when the branch has configured SIDEBAR", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: branding({ navigationLayout: "SIDEBAR" }),
      } as never);

      renderShell();

      expect(screen.getByText("sidebar content")).toBeInTheDocument();
      expect(screen.queryByText("navbar content")).not.toBeInTheDocument();
    });
  });

  describe("what both layouts always render", () => {
    for (const layout of ["NAVBAR", "SIDEBAR"] as const) {
      it(`renders the header, the children and the #main-content landmark under ${layout}`, () => {
        mockedUseBrandingQuery.mockReturnValue({
          data: branding({ navigationLayout: layout }),
        } as never);

        renderShell();

        expect(screen.getByText("header content")).toBeInTheDocument();
        expect(screen.getByText("page content")).toBeInTheDocument();
        // A11Y-3 — the skip link lives outside this shell and targets this
        // `id`; NAV-2's width cap rides on the same element's wrapper.
        const main = screen.getByRole("main");
        expect(main).toHaveAttribute("id", "main-content");
        expect(main.querySelector(".max-w-screen-2xl")).not.toBeNull();
      });

      // Regression guard. A flex item's default `min-width: auto` refuses
      // to shrink below its content's intrinsic width, so without this the
      // sidebar branch put a wide table beside a `w-60` rail and pushed the
      // whole page wider than the viewport — a real horizontal scrollbar at
      // 1440px and below, which the Done Criteria forbid.
      it(`keeps <main> shrinkable (min-w-0) under ${layout}`, () => {
        mockedUseBrandingQuery.mockReturnValue({
          data: branding({ navigationLayout: layout }),
        } as never);

        renderShell();

        expect(screen.getByRole("main")).toHaveClass("min-w-0");
      });
    }
  });

  // The whole reason branding is fetched server-side: without seeding, the
  // first render would show the navbar and then swap to the sidebar on
  // every single page load — the page's entire row/column structure
  // moving, not a detail.
  describe("server-seeded branding (no first-paint flash)", () => {
    it("passes initialBranding to the query as initialData", () => {
      const initial = branding({ navigationLayout: "SIDEBAR" });
      mockedUseBrandingQuery.mockReturnValue({ data: initial } as never);

      renderShell(initial);

      expect(mockedUseBrandingQuery).toHaveBeenCalledWith(initial);
    });

    it("passes undefined rather than null when the server fetch failed", () => {
      renderShell(null);

      expect(mockedUseBrandingQuery).toHaveBeenCalledWith(undefined);
    });

    it("renders the sidebar on the very first render, with no intermediate navbar frame", () => {
      const initial = branding({ navigationLayout: "SIDEBAR" });
      // What `useQuery` actually does with `initialData`: `data` is
      // defined on the first render, never `undefined` first.
      mockedUseBrandingQuery.mockImplementation(
        ((initialData?: BrandingSummary) => ({ data: initialData })) as never,
      );

      renderShell(initial);

      expect(screen.getByText("sidebar content")).toBeInTheDocument();
      expect(screen.queryByText("navbar content")).not.toBeInTheDocument();
    });
  });
});
