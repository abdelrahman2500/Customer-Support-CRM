import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsView } from "./settings-view";
import { PermissionsProvider } from "@/lib/permissions";

// Story 224 (RD-6.5) — the open tab is mirrored in ?tab=.
const replace = vi.fn();
let searchParamsString = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/en/settings",
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// RM-23 — each of the three composed screens already has its own
// dedicated, passing spec file covering its own internals; this
// component's own responsibility is purely the tab composition, so each
// is stood in for here rather than re-testing its internals.
//
// Story 198 — each stand-in records the `hosted` prop it was given, which is
// what tells the real view to render its title as an h2 under this page's h1.
vi.mock("@/components/admin/branding-view", () => ({
  BrandingView: ({ hosted }: { hosted?: boolean }) => (
    <div data-hosted={String(hosted)}>branding panel content</div>
  ),
}));
vi.mock("@/components/admin/ai-settings-view", () => ({
  AiSettingsView: ({ hosted }: { hosted?: boolean }) => (
    <div data-hosted={String(hosted)}>ai panel content</div>
  ),
}));
vi.mock("@/components/business-hours/business-hours-view", () => ({
  BusinessHoursView: ({ hosted }: { hosted?: boolean }) => (
    <div data-hosted={String(hosted)}>business hours panel content</div>
  ),
}));

describe("SettingsView", () => {
  it("renders all three tabs, with the branding panel active by default", () => {
    render(<SettingsView />);

    expect(screen.getByRole("tab", { name: "tabs.branding" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "tabs.ai" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "tabs.businessHours" })).toBeInTheDocument();
    expect(screen.getByText("branding panel content")).toBeInTheDocument();
    expect(screen.queryByText("ai panel content")).not.toBeInTheDocument();
  });

  it("switches to the AI features panel when its tab is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.click(screen.getByRole("tab", { name: "tabs.ai" }));

    expect(screen.getByText("ai panel content")).toBeInTheDocument();
    expect(screen.queryByText("branding panel content")).not.toBeInTheDocument();
  });

  it("switches to the business hours panel when its tab is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.click(screen.getByRole("tab", { name: "tabs.businessHours" }));

    expect(screen.getByText("business hours panel content")).toBeInTheDocument();
  });

  // Story 198 (RD-2.4, recon A11Y-04) — one h1 for the page; every hosted
  // view is told it is hosted, so its own title renders as an h2.
  it("has a single h1 and renders every panel as a hosted view", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("branding panel content")).toHaveAttribute("data-hosted", "true");
    await user.click(screen.getByRole("tab", { name: "tabs.ai" }));
    expect(screen.getByText("ai panel content")).toHaveAttribute("data-hosted", "true");
    await user.click(screen.getByRole("tab", { name: "tabs.businessHours" }));
    expect(screen.getByText("business hours panel content")).toHaveAttribute("data-hosted", "true");
  });

  it("opens the tab named in ?tab= and writes the tab it switches to (Story 224)", async () => {
    searchParamsString = "tab=businessHours";
    render(<SettingsView />);
    expect(screen.getByRole("tab", { name: "tabs.businessHours" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.setup().click(screen.getByRole("tab", { name: "tabs.ai" }));
    expect(replace).toHaveBeenLastCalledWith("/en/settings?tab=ai", { scroll: false });
    searchParamsString = "";
  });
});

// Final UX pass — only the tabs the role can read.
describe("SettingsView — permissions", () => {
  it("shows only the tabs the role can read, opening the first of them", () => {
    searchParamsString = "";
    render(
      <PermissionsProvider permissions={["sla:read"]}>
        <SettingsView />
      </PermissionsProvider>,
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["tabs.businessHours"]);
    expect(screen.getByText("business hours panel content")).toBeInTheDocument();
    expect(screen.queryByText("branding panel content")).not.toBeInTheDocument();
    expect(screen.queryByText("ai panel content")).not.toBeInTheDocument();
  });
});
