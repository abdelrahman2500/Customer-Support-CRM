import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MessageThread, type MessageThreadItem } from "./message-thread";

/** Story 205 (RD-3.5, recon TW-03) — the conversation thread. */
function item(key: string, at: string): MessageThreadItem {
  return { key, at, node: <span>{`message ${key}`}</span> };
}

const DAY_ONE = [item("a", "2026-10-01T09:00:00"), item("b", "2026-10-01T15:30:00")];
const DAY_TWO = [item("c", "2026-10-02T08:15:00")];

function renderThread(items: MessageThreadItem[]) {
  return render(
    <MessageThread
      label="Conversation"
      items={items}
      formatDay={(at) => `day ${at.slice(0, 10)}`}
      newMessagesLabel="New messages"
    />,
  );
}

/** jsdom has no layout: give the log real scroll geometry. */
function setGeometry(
  el: HTMLElement,
  { scrollHeight, clientHeight, scrollTop }: Record<string, number>,
) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
  el.scrollTop = scrollTop!;
}

describe("MessageThread", () => {
  it("is bounded by default and fills its parent when asked (Story 231)", () => {
    const { rerender } = renderThread([item("a", "2026-01-01T10:00:00")]);
    expect(screen.getByRole("log")).toHaveClass("max-h-[60vh]");

    rerender(
      <MessageThread
        fill
        label="Conversation"
        items={[item("a", "2026-01-01T10:00:00")]}
        formatDay={(at) => at.slice(0, 10)}
        newMessagesLabel="New messages"
      />,
    );
    expect(screen.getByRole("log")).toHaveClass("flex-1", "min-h-0");
    expect(screen.getByRole("log")).not.toHaveClass("max-h-[60vh]");
  });

  it("is a labelled, polite log", () => {
    renderThread(DAY_ONE);

    const log = screen.getByRole("log", { name: "Conversation" });
    expect(log).toHaveAttribute("aria-live", "polite");
  });

  it("labels each local day once and keeps the list items exactly the messages", () => {
    renderThread([...DAY_ONE, ...DAY_TWO]);

    expect(screen.getByText("day 2026-10-01")).toBeInTheDocument();
    expect(screen.getByText("day 2026-10-02")).toBeInTheDocument();
    // Day labels are not list items.
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("day 2026-10-01").closest("li")).toBeNull();
  });

  it("scrolls to the newest message on first render", () => {
    const { rerender } = renderThread([]);
    const log = screen.getByRole("log");
    setGeometry(log, { scrollHeight: 900, clientHeight: 300, scrollTop: 0 });

    rerender(
      <MessageThread
        label="Conversation"
        items={DAY_ONE}
        formatDay={(at) => at}
        newMessagesLabel="New messages"
      />,
    );

    expect(log.scrollTop).toBe(900);
  });

  it("follows new messages while the reader is at the bottom", () => {
    const { rerender } = renderThread(DAY_ONE);
    const log = screen.getByRole("log");
    setGeometry(log, { scrollHeight: 900, clientHeight: 300, scrollTop: 600 });
    fireEvent.scroll(log);

    setGeometry(log, { scrollHeight: 1200, clientHeight: 300, scrollTop: 600 });
    rerender(
      <MessageThread
        label="Conversation"
        items={[...DAY_ONE, ...DAY_TWO]}
        formatDay={(at) => at}
        newMessagesLabel="New messages"
      />,
    );

    expect(log.scrollTop).toBe(1200);
    expect(screen.queryByRole("button", { name: "New messages" })).not.toBeInTheDocument();
  });

  it("keeps a reader's position while they read history, and offers a pill to the newest", () => {
    const { rerender } = renderThread(DAY_ONE);
    const log = screen.getByRole("log");
    setGeometry(log, { scrollHeight: 900, clientHeight: 300, scrollTop: 100 });
    fireEvent.scroll(log);

    rerender(
      <MessageThread
        label="Conversation"
        items={[...DAY_ONE, ...DAY_TWO]}
        formatDay={(at) => at}
        newMessagesLabel="New messages"
      />,
    );

    expect(log.scrollTop).toBe(100);
    const pill = screen.getByRole("button", { name: "New messages" });
    setGeometry(log, { scrollHeight: 1200, clientHeight: 300, scrollTop: 100 });
    fireEvent.click(pill);
    expect(log.scrollTop).toBe(1200);
    expect(screen.queryByRole("button", { name: "New messages" })).not.toBeInTheDocument();
  });

  it("hides the pill once the reader scrolls back to the bottom themselves", () => {
    const { rerender } = renderThread(DAY_ONE);
    const log = screen.getByRole("log");
    setGeometry(log, { scrollHeight: 900, clientHeight: 300, scrollTop: 0 });
    fireEvent.scroll(log);
    rerender(
      <MessageThread
        label="Conversation"
        items={[...DAY_ONE, ...DAY_TWO]}
        formatDay={(at) => at}
        newMessagesLabel="New messages"
      />,
    );
    expect(screen.getByRole("button", { name: "New messages" })).toBeInTheDocument();

    setGeometry(log, { scrollHeight: 900, clientHeight: 300, scrollTop: 590 });
    fireEvent.scroll(log);
    expect(screen.queryByRole("button", { name: "New messages" })).not.toBeInTheDocument();
  });
});
