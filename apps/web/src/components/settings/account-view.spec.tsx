import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountView } from "./account-view";
import { useCurrentUserQuery } from "@/hooks/use-tickets";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/hooks/use-tickets", () => ({ useCurrentUserQuery: vi.fn() }));
vi.mock("./my-sessions-view", () => ({
  MySessionsView: ({ hosted }: { hosted?: boolean }) => (
    <h2 data-hosted={String(hosted)}>sessions</h2>
  ),
}));
vi.mock("./change-password-section", () => ({
  ChangePasswordSection: () => <h2>password</h2>,
}));

/** Story 224 (PR-4.3) — one Account area. */
describe("AccountView", () => {
  it("shows who is signed in, then sessions and password under one h1", () => {
    vi.mocked(useCurrentUserQuery).mockReturnValue({
      isLoading: false,
      data: {
        id: "u1",
        email: "sara@demo.example",
        fullName: "Sara Al-Harbi",
        branchId: "b1",
        departmentId: null,
        roles: ["Agent"],
        preferredLocale: null,
      },
    } as never);
    render(<AccountView />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("title");
    expect(screen.getByText("Sara Al-Harbi")).toBeInTheDocument();
    expect(screen.getByText("sara@demo.example")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("sessions")).toHaveAttribute("data-hosted", "true");
    expect(screen.getByText("password")).toBeInTheDocument();
  });
});
