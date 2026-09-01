import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { SuccessToaster } from "./success-toaster";
import { useToastStore, showSuccessToast } from "@/lib/toast-store";
import enMessages from "../../../messages/en.json";

function renderToaster() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SuccessToaster />
    </NextIntlClientProvider>,
  );
}

describe("SuccessToaster (portal)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    useToastStore.setState({ toasts: [] });
  });

  it("renders nothing when there are no toasts", () => {
    const { container } = renderToaster();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a translated success message only after a toast is actually added", () => {
    renderToaster();
    expect(screen.queryByText("Ticket submitted.")).not.toBeInTheDocument();

    act(() => {
      showSuccessToast("Ticket submitted.");
    });

    expect(screen.getByText("Ticket submitted.")).toBeInTheDocument();
  });

  it("renders the message inside a role=status, aria-live=polite region", () => {
    showSuccessToast("Ticket submitted.");
    renderToaster();

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Ticket submitted.");
  });

  it("wraps the toast stack in a labeled region", () => {
    showSuccessToast("Ticket submitted.");
    renderToaster();

    expect(screen.getByRole("region", { name: "Success notifications" })).toBeInTheDocument();
  });

  it("is manually dismissible", () => {
    showSuccessToast("Ticket submitted.");
    renderToaster();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Ticket submitted.")).not.toBeInTheDocument();
  });

  it("auto-dismisses after its timeout", () => {
    vi.useFakeTimers();
    try {
      showSuccessToast("Ticket submitted.");
      renderToaster();
      expect(screen.getByText("Ticket submitted.")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5_001);
      });

      expect(screen.queryByText("Ticket submitted.")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
