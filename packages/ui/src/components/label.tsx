"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../lib/cn";

/**
 * Story S-3 — Radix `Label`, not a bare `<label>`, for one behaviour that
 * matters here: it forwards clicks to the associated control even when that
 * control is a composite widget rather than a native input. That is the gap
 * the recon logged as H-4 — the filter bars wrap a Radix `Select` in a plain
 * `<label>`, which associates with nothing and leaves every filter unnamed
 * to a screen reader.
 *
 * This primitive does not fix those call sites (rewiring the filter bars is
 * S-10's job); it is the piece they will use. `htmlFor` + the control's `id`
 * remains the association, exactly as with a native label.
 *
 * `text-sm text-ink-strong` matches the label styling both apps already use
 * on their form rows.
 */
export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium text-ink-strong peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
