"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story 205 (RD-3.5, recon TW-03) — a conversation thread.
 *
 * - `role="log"` (polite): new messages appended to it are announced.
 * - Messages are grouped by **local** day (the runtime's zone, as every date
 *   in the product); each day gets a date label. The label is plain text
 *   beside the day's `<ol>`, never an `<li>`, so a list's items are exactly
 *   its messages.
 * - Scrolling respects the reader: it follows new messages only while they
 *   are at the bottom (and on first render). Scrolled up reading history,
 *   their position is kept and a "New messages" pill offers the way down.
 *
 * Translation- and locale-free: the caller formats the day labels and names
 * the log and the pill.
 */
export interface MessageThreadItem {
  key: string;
  /** ISO timestamp; decides the item's day group. */
  at: string;
  node: React.ReactNode;
}

export interface MessageThreadProps {
  /** The log's accessible name. */
  label: string;
  items: MessageThreadItem[];
  /** The visible label for a day, given any timestamp on it. */
  formatDay: (at: string) => string;
  /** The pill shown when new messages arrive below a reader scrolled up. */
  newMessagesLabel: string;
  className?: string;
}

/** Within this many pixels of the end counts as "at the bottom". */
const BOTTOM_SLACK_PX = 32;

function dayKey(at: string): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function MessageThread({
  label,
  items,
  formatDay,
  newMessagesLabel,
  className,
}: MessageThreadProps) {
  const logRef = React.useRef<HTMLDivElement>(null);
  const atBottomRef = React.useRef(true);
  const previousCountRef = React.useRef(0);
  const [unseen, setUnseen] = React.useState(false);

  const groups = React.useMemo(() => {
    const result: { key: string; at: string; items: MessageThreadItem[] }[] = [];
    for (const item of items) {
      const key = dayKey(item.at);
      const last = result[result.length - 1];
      if (last && last.key === key) last.items.push(item);
      else result.push({ key, at: item.at, items: [item] });
    }
    return result;
  }, [items]);

  function scrollToEnd() {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
    atBottomRef.current = true;
    setUnseen(false);
  }

  React.useLayoutEffect(() => {
    const previous = previousCountRef.current;
    previousCountRef.current = items.length;
    if (items.length === 0) return;
    if (previous === 0 || atBottomRef.current) {
      scrollToEnd();
    } else if (items.length > previous) {
      setUnseen(true);
    }
  }, [items.length]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={label}
        onScroll={(event) => {
          const el = event.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLACK_PX;
          atBottomRef.current = atBottom;
          if (atBottom) setUnseen(false);
        }}
        className="flex max-h-[60vh] min-h-64 flex-col gap-3 overflow-y-auto py-1"
      >
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-3">
            <p className="flex items-center gap-inline text-caption text-ink-subtle">
              <span aria-hidden="true" className="h-px flex-1 bg-rule-subtle" />
              <span>{formatDay(group.at)}</span>
              <span aria-hidden="true" className="h-px flex-1 bg-rule-subtle" />
            </p>
            <ol className="flex flex-col gap-3">
              {group.items.map((item) => (
                <li key={item.key}>{item.node}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {unseen && (
        <button
          type="button"
          onClick={scrollToEnd}
          className="focus-ring absolute inset-x-0 bottom-2 mx-auto w-fit rounded-pill bg-accent px-3 py-1 text-caption font-medium text-accent-foreground shadow-raised"
        >
          {newMessagesLabel}
        </button>
      )}
    </div>
  );
}
