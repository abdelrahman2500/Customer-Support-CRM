import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceShell } from "./workspace-shell";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useUnreadNotificationCountQuery } from "@/hooks/use-notifications";
import type { BrandingSummary } from "@/lib/branding-api";
import type { AuthenticatedUser } from "@crm/shared";

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

// Final UX pass — the route decides whether the page renders at all.
let pathname = "/en/tickets";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("./no-access-state", () => ({ NoAccessState: () => <div>no access state</div> }));

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

const user: AuthenticatedUser = {
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

function renderShell(initialBranding: BrandingSummary | null = null, shellUser = user) {
  return render(
    <WorkspaceShell user={shellUser} initialBranding={initialBranding}>
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
        // Story 197 (RD-2.3) — the responsive page gutters (16/24/32px).
        expect(screen.getByRole("main")).toHaveClass("px-page-x", "py-page-y");
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

      expect(mockedUseBrandingQuery).toHaveBeenCalledWith(initial, { enabled: true });
    });

    it("passes undefined rather than null when the server fetch failed", () => {
      renderShell(null);

      expect(mockedUseBrandingQuery).toHaveBeenCalledWith(undefined, { enabled: true });
    });

    // Demo hardening — an agent's GET /branding would only 403.
    it("does not request branding for a user without branding:read", () => {
      renderShell(null, { ...user, permissions: ["ticket:read"] });

      expect(mockedUseBrandingQuery).toHaveBeenCalledWith(undefined, { enabled: false });
    });

    it("requests branding for a user with branding:read", () => {
      renderShell(null, { ...user, permissions: ["branding:read"] });

      expect(mockedUseBrandingQuery).toHaveBeenCalledWith(undefined, { enabled: true });
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

// Story 183 (RD-1.6) — the controlled branding model is applied here, once,
// around everything the shell renders.
describe("WorkspaceShell branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseUnreadNotificationCountQuery.mockReturnValue({
      data: undefined,
      isSuccess: false,
    } as never);
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-brand-accent");
  });

  it("applies no brand override for an unbranded branch", () => {
    mockedUseBrandingQuery.mockReturnValue({ data: branding() } as never);

    const { container } = renderShell();

    const scope = container.firstElementChild as HTMLElement;
    expect(scope).toHaveClass("contents");
    expect(scope.getAttribute("style")).toBeNull();
    expect(scope).not.toHaveAttribute("data-brand-accent");
  });

  it("brands the shell from the branch primaryColor, server data first", () => {
    const configured = branding({ primaryColor: "#16A34A" });
    mockedUseBrandingQuery.mockReturnValue({ data: configured } as never);

    const { container } = renderShell(configured);

    const scope = container.firstElementChild as HTMLElement;
    expect(scope.style.getPropertyValue("--brand")).toBe("22 163 74");
    // A green that passes its gates also drives the interactive accent.
    expect(scope).toHaveAttribute("data-brand-accent");
    expect(document.documentElement).toHaveAttribute("data-brand-accent");
  });

  it("keeps the core accent for a red brand, which would read as destructive", () => {
    mockedUseBrandingQuery.mockReturnValue({ data: branding({ primaryColor: "#DC2626" }) } as never);

    const { container } = renderShell();

    const scope = container.firstElementChild as HTMLElement;
    expect(scope.style.getPropertyValue("--brand")).toBe("220 38 38");
    expect(scope).not.toHaveAttribute("data-brand-accent");
  });
});

// Final UX pass — a page the role cannot read is never mounted.
describe("WorkspaceShell — route permissions", () => {
  beforeEach(() => {
    vi.mocked(useBrandingQuery).mockReturnValue({ data: undefined } as never);
    vi.mocked(useUnreadNotificationCountQuery).mockReturnValue({
      data: undefined,
      isSuccess: false,
    } as never);
  });
  afterEach(() => {
    pathname = "/en/tickets";
  });
  const agent: AuthenticatedUser = {
    id: "user-1",
    email: "agent@example.com",
    fullName: "Ada Lovelace",
    branchId: "branch-1",
    departmentId: null,
    roles: ["Agent"],
    preferredLocale: null,
    permissions: ["ticket:read", "sla:read"],
  };
  const renderAt = (path: string, user: AuthenticatedUser) => {
    pathname = path;
    return render(
      <WorkspaceShell user={user} initialBranding={null}>
        <p>page content</p>
      </WorkspaceShell>,
    );
  };

  it("shows the no-access state instead of an admin-only page", () => {
    renderAt("/en/ai-settings", agent);
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
    expect(screen.getByText("no access state")).toBeInTheDocument();
  });

  it("renders a page the role can read, and every page while permissions are unknown", () => {
    const { unmount } = renderAt("/en/sla-policies/new", agent);
    expect(screen.getByText("page content")).toBeInTheDocument();
    unmount();
    renderAt("/en/branding", { ...agent, permissions: undefined });
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("renders the admin's settings pages for an admin", () => {
    renderAt("/en/branding", { ...agent, permissions: ["branding:read"] });
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});
