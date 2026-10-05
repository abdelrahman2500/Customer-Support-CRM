"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story 211 (PR-1.2) — a single choice among a few views: Board | List, the
 * quick views (All · Mine · Unassigned · At risk) and the mobile column
 * switcher.
 *
 * The ARIA radio-group pattern: one tab stop (the checked option), arrows
 * move and select, Home/End jump. Arrow direction follows `dir` — in RTL,
 * ArrowLeft is "next" — because that is the visual order the options sit
 * in. Each option can carry an icon, a count (`tabular-nums`) and a tone
 * dot (e.g. a status spine colour, as a class name).
 */
export interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  /** Background utility for a leading tone dot, e.g. "bg-info-solid". */
  dot?: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** The group's accessible name. */
  "aria-label": string;
  dir?: "ltr" | "rtl";
  size?: "sm" | "md";
  /** Stretch options to fill the width (the mobile column switcher). */
  fill?: boolean;
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  dir = "ltr",
  size = "md",
  fill = false,
  className,
}: SegmentedControlProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function select(index: number) {
    const option = options[index];
    if (!option) return;
    onValueChange(option.value);
    refs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const last = options.length - 1;
    const next = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const previous = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let index: number | null = null;
    if (event.key === next || event.key === "ArrowDown") index = current === last ? 0 : current + 1;
    else if (event.key === previous || event.key === "ArrowUp")
      index = current === 0 ? last : current - 1;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = last;
    if (index !== null) {
      event.preventDefault();
      select(index);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      dir={dir}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-control border border-rule bg-surface-muted p-0.5",
        fill && "flex w-full",
        className,
      )}
    >
      {options.map((option, index) => {
        const checked = index === current;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => select(index)}
            className={cn(
              "focus-ring inline-flex shrink-0 items-center justify-center gap-tight whitespace-nowrap rounded-inner font-medium transition-colors duration-fast",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              fill && "flex-1",
              checked
                ? "bg-surface text-ink ring-1 ring-rule"
                : "text-ink-muted hover:bg-surface hover:text-ink",
            )}
          >
            {option.dot && (
              <span aria-hidden="true" className={cn("h-2 w-2 rounded-pill", option.dot)} />
            )}
            {option.icon}
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span className="rounded-pill bg-surface-muted px-1.5 text-caption tabular-nums text-ink-muted">
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
