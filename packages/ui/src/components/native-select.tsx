"use client";

import * as React from "react";
import { choiceControlClassName } from "../lib/control";
import { cn } from "../lib/cn";

/**
 * Story 182 (RD-1.5) — a token-styled native `<select>` for compact
 * preference controls (language, theme, active branch).
 *
 * Native on purpose: these are short, single-choice lists where the platform
 * control is the most robust option (OS-native picker on touch devices,
 * `color-scheme`-aware in dark mode, typeahead for free). It replaces four
 * hand-styled copies that disagreed on height, radius and whether they had a
 * focus ring at all (recon A11Y-08). For rich, searchable or styled options
 * use `Select`/`Combobox`.
 *
 * It must have an accessible name: pass `aria-label` or associate a `<label>`.
 */
export interface NativeSelectOption {
  readonly value: string;
  readonly label: string;
}

export interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "size"> {
  options: readonly NativeSelectOption[];
  onValueChange: (value: string) => void;
  size?: "sm" | "md";
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ options, onValueChange, size = "sm", className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        // Final UX pass — the filled choice surface (see control.ts).
        "focus-ring",
        choiceControlClassName,
        "w-auto",
        size === "sm" ? "h-8 px-2" : "h-10 px-3",
        className,
      )}
      onChange={(event) => onValueChange(event.target.value)}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
);
NativeSelect.displayName = "NativeSelect";
