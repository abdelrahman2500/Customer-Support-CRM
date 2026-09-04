import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const alertVariants = cva("w-full rounded-md border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "border-rule bg-surface-sunk text-ink-strong",
      destructive: "border-danger-border bg-danger-subtle text-danger-foreground",
      /** Story 25 — matches `Badge`'s existing `success` palette; used for
       * a successful creation confirmation. */
      success: "border-success-border bg-success-subtle text-success-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, role, ...props }: AlertProps) {
  return (
    <div role={role ?? "alert"} className={cn(alertVariants({ variant }), className)} {...props} />
  );
}
