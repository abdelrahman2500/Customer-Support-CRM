import * as React from "react";
import { cn } from "../lib/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/**
 * Story 145 — the row of filters above a list.
 *
 * Three list screens wrote the same responsive row by hand
 * (`flex flex-col gap-3 sm:flex-row sm:flex-wrap`) and two more used a
 * non-responsive `flex flex-wrap items-end gap-2`, so the same control
 * strip behaved differently depending on which screen you were on. Below
 * `sm` the filters stack to full-width tappable rows; from `sm` up they sit
 * inline and wrap. That mobile rule is RM-10's, and encoding it here is
 * what stops the next list screen from quietly dropping it.
 */
export function FilterBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-stack sm:flex-row sm:flex-wrap", className)} {...props} />;
}

/**
 * Story 145 — a labelled dropdown filter with an "everything" option.
 *
 * `ticket-list-view.tsx` and `reports-view.tsx` each defined their own copy
 * of this, identical except for two things: the i18n key for the
 * "all" option, and whether the trigger went full-width on mobile. The copy
 * is now a required prop — this package owns no strings (see `index.ts`) —
 * and the responsive width is the single behaviour, because the
 * non-responsive copy was simply the older of the two.
 *
 * `allValue` is a caller-supplied sentinel rather than `""`: Radix's
 * `Select` cannot represent an empty-string option value, which is why both
 * original copies already carried an `ALL_VALUE` constant.
 */
export interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  /** The sentinel standing for "no filter". */
  allValue: string;
  /** Already-translated label for the "no filter" option. */
  allLabel: string;
  /** Maps an option value to its display text; defaults to the value. */
  renderLabel?: (value: string) => string;
  className?: string;
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allValue,
  allLabel,
  renderLabel,
  className,
}: FilterSelectProps) {
  return (
    <label className={cn("flex flex-col gap-tight text-xs text-ink-muted", className)}>
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-auto sm:min-w-[10rem]" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allValue}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {renderLabel ? renderLabel(option) : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
