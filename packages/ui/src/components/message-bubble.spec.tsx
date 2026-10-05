import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "./message-bubble";

/** Story 205 (RD-3.5) — one message in a thread. */
function renderBubble(props: Partial<React.ComponentProps<typeof MessageBubble>> = {}) {
  return render(
    <MessageBubble
      align="start"
      tone="other"
      sender="Customer"
      avatar={<span>C</span>}
      at="2026-10-01T09:00:00.000Z"
      timeLabel="09:00"
      dateTimeLabel="10/1/2026, 9:00:00 AM"
      {...props}
    >
      Hello there
    </MessageBubble>,
  );
}

describe("MessageBubble", () => {
  it("puts someone else's message at the inline start on the muted surface", () => {
    const { container } = renderBubble();

    expect(container.firstElementChild).toHaveClass("flex-row");
    expect(screen.getByText("Hello there")).toHaveClass("bg-surface-muted", "text-ink-strong");
  });

  it("puts the caller's own message at the inline end on the accent", () => {
    const { container } = renderBubble({ align: "end", tone: "mine", sender: "You" });

    expect(container.firstElementChild).toHaveClass("flex-row-reverse");
    expect(screen.getByText("Hello there")).toHaveClass("bg-accent", "text-accent-foreground");
  });

  it("names the sender and marks up the time with the full date-time as its title", () => {
    renderBubble();

    const time = screen.getByText("09:00");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-10-01T09:00:00.000Z");
    expect(time).toHaveAttribute("title", "10/1/2026, 9:00:00 AM");
    expect(time.parentElement).toHaveTextContent("Customer · 09:00");
  });

  it("appends the delivery state when given one", () => {
    renderBubble({ status: <span>Failed</span> });
    expect(screen.getByText("09:00").parentElement).toHaveTextContent("Customer · 09:00 · Failed");
  });

  // Story 206 (RD-3.6, recon TW-04) — an internal note.
  it("marks an internal note with its own bordered surface and a leading label", () => {
    renderBubble({ tone: "note", label: <span>Internal note</span>, sender: "Jane Agent" });

    expect(screen.getByText("Hello there")).toHaveClass(
      "border",
      "border-warning-border",
      "bg-warning-subtle",
    );
    expect(screen.getByText("Hello there")).not.toHaveClass("bg-accent");
    expect(screen.getByText("Hello there")).not.toHaveClass("bg-surface-muted");
    expect(screen.getByText("09:00").parentElement).toHaveTextContent(
      "Internal note · Jane Agent · 09:00",
    );
    // The sender is its own element, so it can be found on its own.
    expect(screen.getByText("Jane Agent").tagName).toBe("SPAN");
  });

  it("keeps the avatar decorative and uses logical classes only", () => {
    const { container } = renderBubble();

    expect(screen.getByText("C").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(container.innerHTML).not.toMatch(/\b(ml|mr|pl|pr|text-left|text-right)-/);
  });
});
