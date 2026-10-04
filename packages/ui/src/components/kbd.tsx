import * as React from "react";
import { cn } from "../lib/cn";

/** Story 189 (RD-1.12) — a keyboard-key hint ("Enter", "/", "J"), e.g. beside a composer or in a shortcut list. */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-inner border border-rule-strong bg-surface-muted px-1.5 font-sans text-caption font-medium text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
