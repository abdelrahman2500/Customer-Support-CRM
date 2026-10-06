"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { CloseIcon, FilterIcon, SearchIcon } from "../lib/icons";
import { Button } from "./button";
import { Input } from "./input";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

/**
 * Story 211 (PR-1.2, absorbs RD-4.1) — the one toolbar above a list or
 * board: search, filters, a result summary, clear-all and view actions.
 *
 * - **Search** keeps its own draft and commits on Enter or blur (the
 *   behaviour every list already has, which agents and the Playwright specs
 *   rely on), with a clear button that commits "".
 * - **Filters** sit inline from `sm`. Below it they collapse into a
 *   "Filters (n)" button that opens a Sheet holding the same controls, so a
 *   phone never wraps four selects into the page.
 * - **Summary** ("128 tickets") is a polite status, so filtering is
 *   announced; **clear all** appears only while something is filtered.
 * - **Actions** (view toggle, sort, New) sit at the inline end.
 *
 * Translation-free: every label is a prop.
 */
export interface ListToolbarSearch {
  value: string;
  onCommit: (value: string) => void;
  /** The field's accessible name. */
  label: string;
  placeholder?: string;
  clearLabel: string;
  /** Story 223 — commit on every keystroke (a live search), not on blur/Enter. */
  commitOnChange?: boolean;
}

export interface ListToolbarProps {
  search?: ListToolbarSearch;
  filters?: React.ReactNode;
  /** How many filters are active (shown on the mobile Filters button). */
  filterCount?: number;
  filtersLabel?: string;
  closeLabel?: string;
  summary?: React.ReactNode;
  onClearAll?: () => void;
  clearAllLabel?: string;
  /** Show clear-all (defaults to `filterCount > 0`). */
  filtered?: boolean;
  actions?: React.ReactNode;
  /** Content under the main row (e.g. quick views). */
  children?: React.ReactNode;
  className?: string;
}

function SearchField({
  value,
  onCommit,
  label,
  placeholder,
  clearLabel,
  commitOnChange = false,
}: ListToolbarSearch) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  return (
    <Input
      type="search"
      aria-label={label}
      placeholder={placeholder}
      startIcon={SearchIcon}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        if (commitOnChange) onCommit(event.target.value);
      }}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit(draft);
        }
      }}
      endSlot={
        draft ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => {
              setDraft("");
              onCommit("");
            }}
            className="focus-ring rounded-inner p-1 text-ink-subtle hover:bg-surface-muted hover:text-ink"
          >
            <CloseIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : undefined
      }
      // Demo hardening — with a start icon, Input puts `className` on its
      // wrapper, so the native clear button is hidden on the input inside it;
      // the clear button above is the only one.
      className="[&_input::-webkit-search-cancel-button]:hidden"
    />
  );
}

export function ListToolbar({
  search,
  filters,
  filterCount = 0,
  filtersLabel,
  closeLabel,
  summary,
  onClearAll,
  clearAllLabel,
  filtered,
  actions,
  children,
  className,
}: ListToolbarProps) {
  const showClear = (filtered ?? filterCount > 0) && onClearAll && clearAllLabel;
  const filtersButtonLabel =
    filtersLabel && (filterCount > 0 ? `${filtersLabel} (${filterCount})` : filtersLabel);

  return (
    <div className={cn("flex flex-col gap-stack", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <div className="min-w-0 flex-1 basis-56 sm:max-w-xs">
            <SearchField {...search} />
          </div>
        )}
        {filters && (
          <>
            <div className="hidden flex-wrap items-center gap-2 sm:flex">{filters}</div>
            {filtersButtonLabel && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="sm:hidden">
                    <FilterIcon aria-hidden="true" className="h-4 w-4" />
                    {filtersButtonLabel}
                  </Button>
                </SheetTrigger>
                <SheetContent size="sm" closeLabel={closeLabel} aria-describedby={undefined}>
                  <SheetHeader>
                    <SheetTitle>{filtersLabel}</SheetTitle>
                  </SheetHeader>
                  <SheetBody className="flex flex-col gap-stack">{filters}</SheetBody>
                </SheetContent>
              </Sheet>
            )}
          </>
        )}
        {showClear && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
            {clearAllLabel}
          </Button>
        )}
        {actions && <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {(children || summary) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {children}
          {summary && (
            <p role="status" className="ms-auto text-caption tabular-nums text-ink-subtle">
              {summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
