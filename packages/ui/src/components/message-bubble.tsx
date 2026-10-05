import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story 205 (RD-3.5, recon TW-03) — one message in a `MessageThread`.
 *
 * The caller's own message sits at the inline end on the accent; everyone
 * else's at the inline start on a muted surface — logical, so both mirror in
 * RTL. The avatar (decorative: the sender is named in text) sits on the outer
 * side. The meta line names the sender and the time, as a `<time>` whose
 * `title` carries the full date and time; `status` is the delivery slot.
 *
 * Translation- and locale-free: the caller passes formatted labels.
 */
export interface MessageBubbleProps {
  align: "start" | "end";
  tone: "mine" | "other";
  sender: React.ReactNode;
  avatar?: React.ReactNode;
  /** ISO timestamp, for `<time dateTime>`. */
  at: string;
  /** The visible time (e.g. "14:05"). */
  timeLabel: string;
  /** The full date and time, shown on hover/long-press via `title`. */
  dateTimeLabel: string;
  /** Delivery state, appended to the meta line. */
  status?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function MessageBubble({
  align,
  tone,
  sender,
  avatar,
  at,
  timeLabel,
  dateTimeLabel,
  status,
  children,
  className,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        align === "end" ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {avatar && (
        <span aria-hidden="true" className="shrink-0">
          {avatar}
        </span>
      )}
      <div
        className={cn(
          "flex max-w-[80%] min-w-0 flex-col gap-1",
          align === "end" ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-surface px-3 py-2 text-sm whitespace-pre-wrap break-words",
            // `text-accent-foreground`: the token defined as "text on top of
            // --accent", so the pair stays legible under any accent.
            tone === "mine"
              ? "bg-accent text-accent-foreground"
              : "bg-surface-muted text-ink-strong",
          )}
        >
          {children}
        </div>
        <span className="text-xs text-ink-subtle">
          {sender} ·{" "}
          <time dateTime={at} title={dateTimeLabel}>
            {timeLabel}
          </time>
          {status && <> · {status}</>}
        </span>
      </div>
    </div>
  );
}
