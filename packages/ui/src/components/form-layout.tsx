import * as React from "react";
import { cn } from "../lib/cn";
import { ErrorIcon } from "../lib/icons";

/**
 * Story 225 (PR-4.4) — the form-section recipe every create flow uses.
 *
 * - `FormSection` groups related fields under a short title (a real
 *   `fieldset`/`legend`, so the group is announced), with an optional line of
 *   guidance, laid out one column on phones and two from `sm` when `columns`
 *   is 2. Fields are `FormField`s, with their own labels and markers.
 * - `FormActions` ends the form: the submit (and any secondary action), the
 *   reason it is disabled when it is (`reason`, tied to the submit through
 *   `reasonId` for `aria-describedby`), and the submission error right
 *   beside the button that caused it — not at the top of the page.
 */
export function FormSection({
  title,
  description,
  columns = 1,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  columns?: 1 | 2;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-stack", className)}>
      <legend className="mb-tight text-subhead text-ink">{title}</legend>
      {description && <p className="-mt-tight text-body-sm text-ink-muted">{description}</p>}
      <div className={cn("grid grid-cols-1 gap-stack", columns === 2 && "sm:grid-cols-2")}>
        {children}
      </div>
    </fieldset>
  );
}

export function FormActions({
  error,
  reason,
  reasonId,
  className,
  children,
}: {
  /** The submission's error, shown beside the submit. */
  error?: React.ReactNode;
  /** Why the submit is disabled, when it is. */
  reason?: React.ReactNode;
  /** The id the submit's `aria-describedby` points at. */
  reasonId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-stack border-t border-rule-subtle pt-stack", className)}>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-tight rounded-inner bg-danger-surface px-3 py-2 text-body-sm text-danger-foreground"
        >
          <ErrorIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-inline">
        {children}
        {reason && (
          <span id={reasonId} className="text-caption text-ink-muted">
            {reason}
          </span>
        )}
      </div>
    </div>
  );
}
