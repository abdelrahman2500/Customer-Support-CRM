import * as React from "react";
import { cn } from "../lib/cn";
import { ErrorIcon, InfoIcon } from "../lib/icons";

/**
 * Story 199 (RD-2.5) — the one way a page says it could not show what was
 * asked for: route error boundaries, not-found pages, and detail pages whose
 * record failed to load. Before this each was a hand-rolled card (and one
 * portal boundary used a raw `<button>`), and the detail pages showed a bare
 * Alert with no heading, no way back and no retry (recon A11Y-03, VL-08).
 *
 * Server-safe: no hooks, so the server-rendered not-found pages use it too.
 * Translation-free like every primitive here — the caller passes the copy,
 * the retry control (`actions`) and the way back (`back`).
 *
 * `headingLevel` 1 when the error IS the page (boundaries, not-found, a
 * detail record that failed to load); 2 or 3 when it sits under a page
 * header. The icon is decorative: the heading carries the meaning. No
 * `role="alert"` by default — a page that failed to load is a page, not an
 * interruption; a caller that needs an announcement adds the role itself.
 */
export interface ErrorStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** `danger` for a failure; `neutral` for "not found" (nothing went wrong). */
  tone?: "danger" | "neutral";
  headingLevel?: 1 | 2 | 3;
  /** Recovery controls, typically a retry `Button`. */
  actions?: React.ReactNode;
  /** A way back, typically a `BackLink` or a link styled as a button. */
  back?: React.ReactNode;
  className?: string;
}

const TONE = {
  danger: { icon: ErrorIcon, chip: "bg-danger-subtle text-danger-foreground" },
  neutral: { icon: InfoIcon, chip: "bg-surface-muted text-ink-muted" },
} as const;

export function ErrorState({
  title,
  description,
  tone = "danger",
  headingLevel = 2,
  actions,
  back,
  className,
}: ErrorStateProps) {
  const { icon: Icon, chip } = TONE[tone];
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-stack rounded-surface border border-rule bg-surface p-surface text-center",
        className,
      )}
    >
      <span
        className={cn("flex h-10 w-10 items-center justify-center rounded-pill", chip)}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex max-w-prose flex-col gap-tight">
        <Heading className={cn("text-ink", headingLevel === 1 ? "text-title" : "text-heading")}>
          {title}
        </Heading>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {(actions || back) && (
        <div className="flex flex-wrap items-center justify-center gap-inline">
          {actions}
          {back}
        </div>
      )}
    </div>
  );
}
