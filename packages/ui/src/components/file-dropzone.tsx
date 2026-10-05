"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { AttachIcon } from "../lib/icons";
import { buttonVariants } from "./button";

/**
 * Story 208 (RD-3.8, recon A11Y-02) — a labelled single-file picker.
 *
 * The native file input is visually hidden inside a `<label>`, so the whole
 * control opens the picker on click and on Enter/Space, and the input is
 * named by `label` (described by `hint`) — a bare `<input type="file">` is
 * named only by the browser's own "Choose File" text, which is neither
 * translated nor meaningful. The focus ring sits on the visible wrapper.
 *
 * - `variant="area"`: a dashed drop target; dropping takes the first file.
 * - `variant="button"`: the outline small-button look, e.g. in a toolbar.
 *
 * One file at a time, by design: every upload endpoint it serves takes a
 * single file per request. The input is reset after each pick, so the same
 * file can be picked again. Translation-free: the caller passes the text.
 */
export interface FileDropzoneProps {
  /** Visible text and the input's accessible name. */
  label: string;
  /** Secondary text (area variant), announced as the input's description. */
  hint?: string;
  onFile: (file: File) => void;
  variant?: "area" | "button";
  disabled?: boolean;
  accept?: string;
  className?: string;
}

const focusWithin =
  "has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface";

export function FileDropzone({
  label,
  hint,
  onFile,
  variant = "area",
  disabled = false,
  accept,
  className,
}: FileDropzoneProps) {
  const hintId = React.useId();
  const [dragging, setDragging] = React.useState(false);
  const showHint = variant === "area" && hint;

  function take(file: File | undefined) {
    if (file && !disabled) onFile(file);
  }

  return (
    <label
      data-dragging={dragging ? "" : undefined}
      aria-disabled={disabled || undefined}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        take(event.dataTransfer.files?.[0]);
      }}
      className={cn(
        focusWithin,
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        variant === "button"
          ? buttonVariants({ variant: "outline", size: "sm" })
          : "flex flex-col items-center gap-1 rounded-control border border-dashed border-rule-strong p-4 text-center text-sm text-ink transition-colors duration-fast hover:bg-surface-muted data-[dragging]:border-accent data-[dragging]:bg-accent-surface",
        className,
      )}
    >
      <input
        type="file"
        className="sr-only"
        aria-label={label}
        aria-describedby={showHint ? hintId : undefined}
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          take(file);
        }}
      />
      <span className="inline-flex items-center gap-tight font-medium">
        <AttachIcon aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </span>
      {showHint && (
        <span id={hintId} className="text-caption text-ink-subtle">
          {hint}
        </span>
      )}
    </label>
  );
}
