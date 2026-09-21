import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story 141 — one shape for "a labelled control, with an optional hint and
 * an optional validation error".
 *
 * Before this, `apps/web` hand-assembled that shape 74 times in two
 * densities (`text-xs text-ink-muted` ×50, `text-sm text-ink-strong` ×24)
 * and rendered the error in five different ways across 40 sites —
 * `text-xs text-red-600`, `mt-1 text-xs text-red-600`, a bare
 * `text-red-600`, and so on. Every one of those bypassed the `--danger-*`
 * tokens, and they disagreed on size and spacing.
 *
 * ## Why a `<label>` wrapper
 *
 * The control is rendered *inside* the `<label>`, which is the implicit-
 * labelling pattern every one of those 74 call sites already used. It needs
 * no generated `id`/`htmlFor` pair and cannot desynchronise. A field whose
 * control cannot be nested (a Radix `Select` trigger, a checkbox with its
 * label beside it) keeps using `Label` + `htmlFor` instead; this component
 * is not a universal wrapper and does not try to be.
 *
 * ## Density
 *
 * `compact` is the default because it is what the majority of existing
 * fields use — the dense admin forms where a field is one row among many.
 * `comfortable` is the primary-form treatment (create/edit screens, login)
 * where the label is the field's main affordance.
 *
 * ## Error colour
 *
 * `text-danger-foreground`, the token `Alert`, `Badge` and `DropdownMenu`
 * already use for danger text. This is deliberately a touch darker than the
 * `red-600` it replaces (the token resolves to red-800), which raises
 * contrast on the light surfaces these errors sit on. The `--danger-solid`
 * token is the exact old value, but it names a *fill*, not text.
 */
export interface FormFieldProps {
  /** The field's visible label. */
  label: React.ReactNode;
  /** The control itself — an `Input`, `Textarea`, native `select`, etc. */
  children: React.ReactNode;
  /** Guidance shown under the control, always visible. */
  hint?: React.ReactNode;
  /**
   * A validation message. Rendered only when truthy, so a call site can pass
   * a possibly-empty error straight through. Announced politely rather than
   * assertively: a field error appearing as you type should not interrupt.
   */
  error?: React.ReactNode;
  density?: "compact" | "comfortable";
  className?: string;
}

const DENSITY = {
  compact: "text-xs text-ink-muted",
  comfortable: "text-sm text-ink-strong",
} as const;

export function FormField({
  label,
  children,
  hint,
  error,
  density = "compact",
  className,
}: FormFieldProps) {
  return (
    <label className={cn("flex flex-col gap-tight", DENSITY[density], className)}>
      {label}
      {children}
      {hint && <span className="text-xs text-ink-subtle">{hint}</span>}
      {error && (
        <span role="status" className="text-xs text-danger-foreground">
          {error}
        </span>
      )}
    </label>
  );
}
