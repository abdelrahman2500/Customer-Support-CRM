"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story 211 (PR-1.2) — an on/off preference toggle (notification
 * preferences, settings). A native `<button role="switch">`: Space and Enter
 * toggle it, `aria-checked` carries the state, and it is named by its
 * `<Label htmlFor>` or `aria-label`. The thumb moves to the inline end when
 * on, so it mirrors in RTL. No dependency: the ARIA switch pattern is one
 * attribute on a button.
 */
export interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "value"
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, className, onClick, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
      className={cn(
        "focus-ring inline-flex h-6 w-11 shrink-0 items-center rounded-pill border-2 border-transparent transition-colors duration-fast ease-standard disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-accent" : "bg-rule-control",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "block h-5 w-5 rounded-pill bg-surface shadow-resting transition-[margin] duration-fast ease-standard",
          checked ? "ms-5" : "ms-0",
        )}
      />
    </button>
  ),
);
Switch.displayName = "Switch";
