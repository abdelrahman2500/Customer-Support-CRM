import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story 189 (RD-1.12) — key/value pairs (ticket properties, customer facts).
 * A real `<dl>`; each pair is a `<div>` wrapping one `<dt>` and one `<dd>`,
 * which HTML allows inside a description list.
 */
export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  columns?: 1 | 2;
}

export function DescriptionList({ columns = 1, className, ...props }: DescriptionListProps) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-section gap-y-stack",
        columns === 2 && "sm:grid-cols-2",
        className,
      )}
      {...props}
    />
  );
}

export interface DescriptionItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  term: React.ReactNode;
  /** The description (value). */
  children: React.ReactNode;
}

export function DescriptionItem({ term, children, className, ...props }: DescriptionItemProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-tight", className)} {...props}>
      <dt className="text-caption text-ink-subtle">{term}</dt>
      <dd className="min-w-0 break-words text-body text-ink">{children}</dd>
    </div>
  );
}
