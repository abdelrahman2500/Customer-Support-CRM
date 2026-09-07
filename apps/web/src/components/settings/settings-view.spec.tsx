import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsView } from "./settings-view";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// RM-23 — each of the three composed screens already has its own
// dedicated, passing spec file covering its own internals; this
// component's own responsibility is purely the tab composition, so each
// is stood in for here rather than re-testing its internals.
vi.mock("@/components/admin/branding-view", () => ({
  BrandingView: () => <div>branding panel content</div>,
}));
vi.mock("@/components/admin/ai-settings-view", () => ({
  AiSettingsView: () => <div>ai panel content</div>,
}));
vi.mock("@/components/business-hours/business-hours-view", () => ({
  BusinessHoursView: () => <div>business hours panel content</div>,
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
});
