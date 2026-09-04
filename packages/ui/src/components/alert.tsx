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

/**
 * Story S-4 — the default ARIA role now follows the variant.
 *
 * Previously every `Alert` defaulted to `role="alert"`, which is an
 * *assertive* live region: it interrupts whatever a screen reader is
 * currently saying. That is right for the 64 `variant="destructive"` call
 * sites — a submission that just failed should cut in — and wrong for the
 * informational and success ones, where it means a confirmation banner
 * talks over the user mid-sentence.
 *
 * `role="status"` is the polite equivalent: announced at the next natural
 * pause instead of immediately. Both roles carry their own implicit
 * `aria-live` (`assertive` and `polite` respectively), so no explicit
 * `aria-live` is needed and none is added.
 *
 * This is a default, not a rule — an explicit `role` prop still wins, so a
 * caller with a genuinely urgent informational message can ask for
 * `role="alert"`, and one rendering a purely decorative note can pass
 * `role={undefined}` to opt out of live-region semantics entirely.
 *
 * Nothing visual changes: the variants, their palettes, focus behaviour and
 * RTL behaviour are untouched.
 */
const ROLE_BY_VARIANT = {
  default: "status",
  success: "status",
  destructive: "alert",
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, role, ...props }: AlertProps) {
  return (
    <div
      role={role ?? ROLE_BY_VARIANT[variant ?? "default"]}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
