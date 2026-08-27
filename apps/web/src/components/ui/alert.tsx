import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("w-full rounded-md border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "border-slate-200 bg-slate-50 text-slate-800",
      destructive: "border-red-200 bg-red-50 text-red-800",
      /** Story 25 — matches `Badge`'s existing `success` palette; used for
       * a successful creation confirmation. */
      success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, role, ...props }: AlertProps) {
  return (
    <div
      role={role ?? "alert"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
