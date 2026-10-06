import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ACCESS_TOKEN_COOKIE } from "@/lib/api";
import { SessionGuard } from "./session-guard";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

/** An unsigned token whose payload carries `sub` — the guard only reads it. */
function signInAs(sub: string) {
  const payload = btoa(JSON.stringify({ sub })).replace(/=+$/, "");
  document.cookie = `${ACCESS_TOKEN_COOKIE}=header.${payload}.signature; path=/`;
}

// Final UX pass — a layout rendered for one person never shows in a tab
// signed in as another.
describe("SessionGuard", () => {
  afterEach(() => {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
    refresh.mockClear();
  });

  it("renders the layout for the person this tab is signed in as", () => {
    signInAs("person-a");
    render(<SessionGuard subject="person-a">private content</SessionGuard>);

    expect(screen.getByText("private content")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows nothing of a layout rendered for someone else, and refreshes it", () => {
    signInAs("person-b");
    const { container } = render(<SessionGuard subject="person-a">private content</SessionGuard>);

    expect(screen.queryByText("private content")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
