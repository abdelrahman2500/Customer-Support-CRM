"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { menuContentClassName, menuItemClassName } from "../lib/menu";
import { Button } from "./button";
import { Textarea } from "./textarea";

/**
 * Story 207 (RD-3.7, recon A11Y-05/A11Y-09) — a message composer: a field,
 * an optional toolbar above it, and a footer row with the caller's extras,
 * a hint and the submit button.
 *
 * - **Enter submits**, Shift+Enter adds a line, and an Enter that belongs to
 *   an IME composition (Arabic, CJK, …) never submits: `isComposing`,
 *   `keyCode` 229 and an open `compositionstart` all count, the last because
 *   some browsers end the composition before the confirming keydown.
 * - **The field is never disabled** while a submit is pending — disabling it
 *   drops focus — and focus returns to it once the submit settles, however
 *   it was sent. The submit button carries the pending state instead.
 * - **Suggestions** (e.g. @mentions) use the combobox pattern on the field
 *   itself: `role="combobox"` with `aria-expanded`/`aria-controls`/
 *   `aria-activedescendant` over a `role="listbox"`; ArrowUp/ArrowDown move
 *   (wrapping), Enter or Tab picks, Escape dismisses.
 * - `tone="note"` tints the field as an internal note.
 *
 * Translation-free: the caller passes every label.
 */
export interface ComposerSuggestion {
  id: string;
  label: string;
}

export interface ComposerProps {
  /** The field's accessible name — never only its placeholder. */
  label: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void | Promise<unknown>;
  submitLabel: React.ReactNode;
  /** Whether a submit may happen now (e.g. non-empty and not pending). */
  canSubmit: boolean;
  pending?: boolean;
  tone?: "default" | "note";
  rows?: number;
  /** Above the field (e.g. a quick-reply picker). */
  toolbar?: React.ReactNode;
  /** Beside the submit button (e.g. a channel option). */
  footer?: React.ReactNode;
  /** A short hint in the footer row (e.g. the Enter key). */
  hint?: React.ReactNode;
  error?: React.ReactNode;
  suggestions?: {
    label: string;
    options: ComposerSuggestion[];
    onPick: (id: string) => void;
    onDismiss: () => void;
  };
  className?: string;
  /** Story 208 — lets the caller focus the field (e.g. after inserting text). */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
}

export function Composer({
  label,
  placeholder,
  value,
  onValueChange,
  onSubmit,
  submitLabel,
  canSubmit,
  pending = false,
  tone = "default",
  rows = 3,
  toolbar,
  footer,
  hint,
  error,
  suggestions,
  className,
  textareaRef,
}: ComposerProps) {
  const fieldRef = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(textareaRef, () => fieldRef.current as HTMLTextAreaElement);
  const composingRef = React.useRef(false);
  const listId = React.useId();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const options = suggestions?.options ?? [];
  const open = options.length > 0;
  const optionKey = options.map((option) => option.id).join("|");

  React.useEffect(() => {
    setActiveIndex(0);
  }, [optionKey]);

  async function submit() {
    if (!canSubmit) return;
    try {
      await onSubmit();
    } finally {
      fieldRef.current?.focus();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const composing =
      event.nativeEvent.isComposing || event.keyCode === 229 || composingRef.current;
    if (composing) return;

    if (open && suggestions) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((index) => (index + step + options.length) % options.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const option = options[activeIndex] ?? options[0];
        if (option) suggestions.onPick(option.id);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        suggestions.onDismiss();
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <form
      aria-busy={pending || undefined}
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {toolbar}
      <div className="relative">
        <Textarea
          ref={fieldRef}
          rows={rows}
          value={value}
          aria-label={label}
          placeholder={placeholder}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          className={cn("w-full", tone === "note" && "border-warning-border bg-warning-subtle")}
          {...(suggestions
            ? {
                role: "combobox",
                "aria-autocomplete": "list" as const,
                "aria-expanded": open,
                "aria-controls": listId,
                "aria-activedescendant": open ? optionId(activeIndex) : undefined,
              }
            : {})}
        />
        {suggestions && (
          <ul
            id={listId}
            role="listbox"
            aria-label={suggestions.label}
            hidden={!open}
            className={cn(menuContentClassName, "absolute top-full z-20 mt-1 w-56")}
          >
            {options.map((option, index) => (
              <li
                key={option.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex ? "" : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => suggestions.onPick(option.id)}
                className={cn(menuItemClassName, "data-[active]:bg-surface-muted")}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-inline gap-y-2">
        {footer}
        {hint && <span className="text-caption text-ink-subtle">{hint}</span>}
        <Button type="submit" size="sm" disabled={!canSubmit} className="ms-auto">
          {submitLabel}
        </Button>
      </div>
      {error}
    </form>
  );
}
