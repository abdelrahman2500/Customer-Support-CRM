"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { controlClassName } from "../lib/control";
import { CheckIcon, ChevronDownIcon } from "../lib/icons";
import { menuItemClassName } from "../lib/menu";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * Story 204 (RD-3.4, recon TW-08) — a searchable single-select: the ARIA 1.2
 * combobox-with-listbox pattern on a Radix Popover.
 *
 * - The **trigger** is a `role="combobox"` button (named by `aria-label`,
 *   `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`), styled
 *   exactly like `SelectTrigger`. Click, ArrowDown or ArrowUp opens it.
 * - The **panel** holds a search input (`role="combobox"`,
 *   `aria-autocomplete="list"`, `aria-activedescendant`) and a
 *   `role="listbox"` of `role="option"` items (`aria-selected`). Focus stays
 *   in the input; the active option is conveyed by `aria-activedescendant`.
 * - **Keys:** ArrowUp/ArrowDown move the active option, Home/End jump, Enter
 *   selects, Escape closes (Radix returns focus to the trigger). Typing
 *   filters by label and description — the type-ahead.
 *
 * Translation-free like every primitive here: the caller passes the label,
 * placeholder, search label and empty text. An option's `description` is
 * plain text inside the option, so it is part of its accessible name (e.g. an
 * agent's presence). Logical classes only; Radix positions the panel per
 * the document direction.
 */
export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary text, announced with the label (e.g. "Online"). */
  description?: string;
  /** Decorative leading content (e.g. an aria-hidden Avatar). */
  leading?: React.ReactNode;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  /** The field's accessible name (also the listbox's). */
  "aria-label": string;
  /** Trigger text while nothing is selected. */
  placeholder: string;
  /** The search input's accessible name and placeholder. */
  searchLabel: string;
  /** Shown when the filter matches nothing. */
  emptyText: string;
  disabled?: boolean;
  className?: string;
}

function matches(option: ComboboxOption, query: string): boolean {
  if (!query) return true;
  const needle = query.toLocaleLowerCase();
  return (
    option.label.toLocaleLowerCase().includes(needle) ||
    (option.description?.toLocaleLowerCase().includes(needle) ?? false)
  );
}

export function Combobox({
  options,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  placeholder,
  searchLabel,
  emptyText,
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listboxId = React.useId();
  const optionIdPrefix = React.useId();
  const listRef = React.useRef<HTMLUListElement>(null);

  const filtered = React.useMemo(() => options.filter((o) => matches(o, query)), [options, query]);
  const selected = options.find((o) => o.value === value);

  function openPanel(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      const index = options.findIndex((o) => o.value === value);
      setActiveIndex(index >= 0 ? index : 0);
    }
  }

  function choose(option: ComboboxOption | undefined) {
    if (!option) return;
    if (option.value !== value) onValueChange(option.value);
    setOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const last = filtered.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(Math.max(last, 0));
        break;
      case "Enter":
        event.preventDefault();
        choose(filtered[activeIndex]);
        break;
      default:
        break;
    }
  }

  const activeOption = filtered[activeIndex];
  const activeId = activeOption ? `${optionIdPrefix}-${activeIndex}` : undefined;

  return (
    <Popover open={open} onOpenChange={openPanel}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          disabled={disabled}
          onKeyDown={(event) => {
            if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              openPanel(true);
            }
          }}
          className={cn(
            // Story 186 (RD-1.9) — the shared control look, identical to SelectTrigger.
            "focus-ring-always flex h-10 items-center justify-between gap-2 px-3 text-start",
            controlClassName,
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.leading}
            <span className={cn("truncate", !selected && "text-ink-subtle")}>
              {selected ? selected.label : placeholder}
            </span>
          </span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-[var(--radix-popover-trigger-width)] min-w-56 flex-col gap-1 p-1"
      >
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-label={searchLabel}
          placeholder={searchLabel}
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onInputKeyDown}
          className={cn("focus-ring-always h-8 px-2.5 text-xs", controlClassName)}
        />
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="max-h-64 overflow-y-auto"
        >
          {filtered.map((option, index) => (
            <li
              key={option.value}
              id={`${optionIdPrefix}-${index}`}
              data-index={index}
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex ? "" : undefined}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              className={cn(menuItemClassName, "data-[active]:bg-surface-muted")}
            >
              {option.leading}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{option.label}</span>
                {option.description && (
                  <span className="text-caption text-ink-subtle">{option.description}</span>
                )}
              </span>
              {option.value === value && (
                <CheckIcon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
        {filtered.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-ink-subtle">{emptyText}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
