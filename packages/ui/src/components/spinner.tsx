import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story S-3 — the one loading indicator, used by `Button`'s loading state and
 * available for any future pending surface.
 *
 * `currentColor`, not a token: a spinner is almost always shown inside
 * something that has already established a text colour — a primary button
 * (white on accent), an outline button (ink), a card body (ink-muted) — so
 * inheriting is what keeps it correct in every context without the caller
 * choosing. Size comes from `className` for the same reason; the `h-4 w-4`
 * default matches the icon size `Select` already uses.
 *
 * Purely decorative by default: `aria-hidden`, because the accessible name
 * for "this is busy" belongs on the control that owns the operation (see
 * `Button`'s `aria-busy`), not on a duplicate live region here. A caller that
 * genuinely needs an announced standalone spinner passes `label`.
 *
 * `prefers-reduced-motion` is honoured via `motion-reduce:animate-none`: the
 * ring still renders, it just stops rotating.
 */
export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  /** Accessible label. Supplying it swaps `aria-hidden` for `role="status"`. */
  label?: string;
}

export function Spinner({ className, label, ...props }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-4 w-4 animate-spin motion-reduce:animate-none", className)}
      {...(label
        ? { role: "status" as const, "aria-label": label }
        : { "aria-hidden": true, focusable: false })}
      {...props}
    >
      {/* Track — the full ring at low opacity, so the moving arc reads as
          progress rather than as a lone floating stroke. */}
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      {/* Arc — a quarter turn, rounded so it does not look clipped. */}
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
