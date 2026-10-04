import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { SuccessToaster } from "./success-toaster";
import { useToastStore, showSuccessToast, showToast } from "../lib/toast-store";

// The two accessible names are props now, not resolved from a message
// catalog — the primitive owns no copy. The values below are the same ones
// each app binds from its own `common` namespace, so the assertions on
// "Success notifications"/"Dismiss" below keep testing the same behaviour.
function renderToaster() {
  return render(<SuccessToaster regionLabel="Success notifications" dismissLabel="Dismiss" />);
}

describe("SuccessToaster", () => {
  beforeEach(() => {
    vi.useRealTimers();
    useToastStore.setState({ toasts: [] });
  });

  // Story 190 (RD-1.13, recon A11Y-10) — the region and its polite live list
  // are mounted before any toast, so the first toast is announced.
  it("renders an empty, labelled live region before any toast", () => {
    renderToaster();
    const region = screen.getByRole("region", { name: "Success notifications" });
    const list = within(region).getByRole("list");
    expect(list).toHaveAttribute("aria-live", "polite");
    expect(within(list).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("renders a translated success message only after a toast is actually added", () => {
    renderToaster();
    expect(screen.queryByText("Ticket created.")).not.toBeInTheDocument();

    act(() => {
      showSuccessToast("Ticket created.");
    });

    expect(screen.getByText("Ticket created.")).toBeInTheDocument();
  });

  it("renders the message inside the polite live list", () => {
    showSuccessToast("Ticket created.");
    renderToaster();

    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("aria-live", "polite");
    expect(within(list).getByRole("listitem")).toHaveTextContent("Ticket created.");
  });

  it("wraps the toast stack in a labeled region", () => {
    showSuccessToast("Ticket created.");
    renderToaster();

    expect(screen.getByRole("region", { name: "Success notifications" })).toBeInTheDocument();
  });

  it("is manually dismissible", () => {
    showSuccessToast("Ticket created.");
    renderToaster();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Ticket created.")).not.toBeInTheDocument();
  });

  it("auto-dismisses after its timeout", () => {
    vi.useFakeTimers();
    try {
      showSuccessToast("Ticket created.");
      renderToaster();
      expect(screen.getByText("Ticket created.")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5_001);
      });

      expect(screen.queryByText("Ticket created.")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps the number of visible toasts", () => {
    showSuccessToast("First");
    showSuccessToast("Second");
    showSuccessToast("Third");
    showSuccessToast("Fourth");
    renderToaster();

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });

  /** Story S-4 — the dismiss button was the only interactive element in
   * this package without the shared focus treatment. */
  it("gives the dismiss button the shared focus ring and keeps it reachable", async () => {
    showSuccessToast("Ticket created.");
    renderToaster();

    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    expect(dismiss).toHaveClass("focus-ring");

    dismiss.focus();
    expect(dismiss).toHaveFocus();

    fireEvent.click(dismiss);
    expect(screen.queryByText("Ticket created.")).not.toBeInTheDocument();
  });

  /** Story 190 (RD-1.13) — tones, position and the design-language card. */
  it("announces error toasts assertively with the danger border and an icon", () => {
    showToast("Could not save.", { tone: "error" });
    renderToaster();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Could not save.");
    expect(alert).toHaveClass("border-danger-border");
    expect(alert.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it("gives each tone its semantic border and keeps success the default", () => {
    showToast("Heads up.", { tone: "info" });
    showToast("Careful.", { tone: "warning" });
    showToast("Saved.");
    renderToaster();

    expect(screen.getByText("Heads up.").closest("li")).toHaveClass("border-info-border");
    expect(screen.getByText("Careful.").closest("li")).toHaveClass("border-warning-border");
    expect(screen.getByText("Saved.").closest("li")).toHaveClass("border-success-border");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sits in a 320px-safe region and uses the raised overlay card", () => {
    showSuccessToast("Ticket created.");
    renderToaster();

    const region = screen.getByRole("region", { name: "Success notifications" });
    expect(region).toHaveClass("inset-x-4", "sm:inset-x-auto", "sm:end-4", "sm:w-96", "bottom-4");
    expect(region).not.toHaveClass("w-full");
    expect(screen.getByRole("listitem")).toHaveClass(
      "rounded-surface",
      "bg-surface-raised",
      "shadow-overlay",
    );
  });
});
