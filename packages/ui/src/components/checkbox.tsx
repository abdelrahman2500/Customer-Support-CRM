"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Story S-3 — neither app had a checkbox of any kind, so there is no existing
 * appearance to preserve; this is built to match `Input`'s box (same
 * `rounded`-family, same `border-rule-strong`, same `bg-surface`, same shared
 * `.focus-ring`) and `Badge`'s accent fill when checked.
 *
 * Radix rather than a styled native input, for the indeterminate state: a
 * "select all" header checkbox needs a third visual state that
 * `input[type=checkbox]` can only express through imperative DOM assignment.
 * `checked="indeterminate"` renders the dash here and reports
 * `aria-checked="mixed"` — which is what a future bulk-selection table needs,
 * and is not something to retrofit later.
 *
 * The box is `h-4 w-4` to sit on the text baseline of a `text-sm` label
 * without the row growing.
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "focus-ring peer h-4 w-4 shrink-0 rounded-[0.25rem] border border-rule-strong bg-surface shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-foreground",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      {props.checked === "indeterminate" ? (
        <Minus className="h-3 w-3" aria-hidden />
      ) : (
        <Check className="h-3 w-3" aria-hidden />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
