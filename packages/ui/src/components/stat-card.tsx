import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/cn";
import { recipes } from "../lib/recipes";
import { Skeleton } from "./skeleton";

/**
 * Story 211 (PR-1.2, absorbs RD-4.6's StatCard) — one KPI: a `display`
 * number in `tabular-nums`, its label, an optional hint and an optional tone
 * edge (e.g. "breached" in the danger tone). Router-free: pass `asChild`
 * with the app's link to make the whole card navigate (to the board column
 * or quick view the number counts), and it gets the liftable hover.
 *
 * `value` undefined renders an em dash (unknown), and `loading` a skeleton.
 */
export interface StatCardProps extends React.HTMLAttributes<HTMLElement> {
  label: string;
  value: number | string | undefined;
  hint?: React.ReactNode;
  loading?: boolean;
  /** Border utility for a 3px inline-start tone edge, e.g. "border-danger-solid". */
  edge?: string;
  icon?: React.ReactNode;
  asChild?: boolean;
}

export const StatCard = React.forwardRef<HTMLElement, StatCardProps>(
  (
    {
      label,
      value,
      hint,
      loading = false,
      edge,
      icon,
      asChild = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = (asChild ? Slot : "div") as React.ElementType;
    const body = (
      <>
        <span className="flex items-center gap-tight text-label text-ink-muted">
          {icon}
          {label}
        </span>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-16" />
        ) : (
          <span className="mt-1 block text-display tabular-nums text-ink">{value ?? "—"}</span>
        )}
        {hint && <span className="mt-1 block text-caption text-ink-subtle">{hint}</span>}
      </>
    );
    return (
      <Comp
        ref={ref}
        className={cn(
          recipes.card,
          "flex flex-col p-surface",
          edge && cn("border-s-[3px]", edge),
          asChild && cn(recipes.liftable, "focus-ring hover:border-rule-strong"),
          className,
        )}
        {...props}
      >
        {asChild && React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ children?: React.ReactNode }>, {
              children: body,
            })
          : body}
      </Comp>
    );
  },
);
StatCard.displayName = "StatCard";
