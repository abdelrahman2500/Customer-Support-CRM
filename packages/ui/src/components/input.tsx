import * as React from "react";
import { cn } from "../lib/cn";
import { controlClassName, controlHeightClassName } from "../lib/control";
import type { ControlSize } from "../lib/control";
import type { LucideIcon } from "../lib/icons";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Story 186 (RD-1.9) — comfortable `md` (40px, the default) or compact
   * `sm` (32px, toolbars and table cells). Named `controlSize` because
   * `size` is a native <input> attribute.
   */
  controlSize?: ControlSize;
  /** A decorative leading icon (e.g. search), inside the control. */
  startIcon?: LucideIcon;
  /** Trailing content inside the control (e.g. a clear button). */
  endSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, controlSize = "md", startIcon: StartIcon, endSlot, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        className={cn(
          "focus-ring flex",
          controlClassName,
          controlHeightClassName[controlSize],
          StartIcon && "ps-9",
          endSlot != null && "pe-10",
          // Without adornments the caller styles the input itself, exactly as
          // before; with them, `className` sizes the wrapper instead.
          !StartIcon && endSlot == null && className,
        )}
        {...props}
      />
    );
    if (!StartIcon && endSlot == null) {
      return input;
    }
    return (
      <div className={cn("relative flex w-full items-center", className)}>
        {StartIcon && (
          <StartIcon
            className="pointer-events-none absolute start-3 h-4 w-4 text-ink-subtle"
            aria-hidden="true"
          />
        )}
        {input}
        {endSlot != null && <div className="absolute end-1 flex items-center">{endSlot}</div>}
      </div>
    );
  },
);
Input.displayName = "Input";
