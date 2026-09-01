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

describe("SuccessToaster", () => {
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
    expect(screen.queryByText("Ticket created.")).not.toBeInTheDocument();

    act(() => {
      showSuccessToast("Ticket created.");
    });

    expect(screen.getByText("Ticket created.")).toBeInTheDocument();
  });

  it("renders the message inside a role=status, aria-live=polite region", () => {
    showSuccessToast("Ticket created.");
    renderToaster();

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Ticket created.");
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

    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });
});
