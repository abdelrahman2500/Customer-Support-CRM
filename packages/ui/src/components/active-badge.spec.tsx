import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActiveBadge } from "./active-badge";

/** Story 227 (PR-4.6) — one active/inactive status for admin lists. */
describe("ActiveBadge", () => {
  it("says the state in words, with a decorative dot, in the success tone when active", () => {
    render(<ActiveBadge active activeLabel="Active" inactiveLabel="Inactive" />);
    const badge = screen.getByText("Active");
    expect(badge).toHaveClass("bg-success-surface");
    expect(badge.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("is quiet when inactive", () => {
    render(<ActiveBadge active={false} activeLabel="Active" inactiveLabel="Inactive" />);
    expect(screen.getByText("Inactive")).toHaveClass("bg-surface-muted");
  });
});
