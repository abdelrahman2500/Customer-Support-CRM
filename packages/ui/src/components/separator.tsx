import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story 189 (RD-1.12) — a rule on the `rule` token. Decorative by default
 * (most dividers only separate visually); pass `decorative={false}` when the
 * break is meaningful, which exposes `role="separator"` and its orientation.
 */
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

export function Separator({
  orientation = "horizontal",
  decorative = true,
  className,
  ...props
}: SeparatorProps) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-rule",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        className,
      )}
      {...props}
    />
  );
}
