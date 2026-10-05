"use client";

import * as React from "react";
import { HidePasswordIcon, ShowPasswordIcon } from "../lib/icons";
import { Input, type InputProps } from "./input";

/**
 * Story 214 (PR-2.2) — a password field with a show/hide toggle, in two
 * parts so the toggle stays OUT of the field's <label>:
 *
 *   <FormField label="Password" action={<PasswordToggle … />}>
 *     <PasswordInput visible={visible} … />
 *   </FormField>
 *
 * A button inside a <label> joins the input's accessible name ("Password
 * Show password"); `FormField`'s `action` slot draws the toggle over the
 * field's end without that. The toggle is named by `showLabel`/`hideLabel`,
 * carries `aria-pressed`, and never submits.
 *
 * Translation-free: both labels are props.
 */
export interface PasswordInputProps extends Omit<InputProps, "type" | "endSlot"> {
  /** Show the characters (controlled by the page, toggled by `PasswordToggle`). */
  visible: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ visible, className, ...props }, ref) => (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      // Room for the toggle drawn over the field's end.
      className={["pe-11", className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
);
PasswordInput.displayName = "PasswordInput";

export interface PasswordToggleProps {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  showLabel: string;
  hideLabel: string;
}

export function PasswordToggle({
  visible,
  onVisibleChange,
  showLabel,
  hideLabel,
}: PasswordToggleProps) {
  const Icon = visible ? HidePasswordIcon : ShowPasswordIcon;
  return (
    <button
      type="button"
      aria-label={visible ? hideLabel : showLabel}
      aria-pressed={visible}
      onClick={() => onVisibleChange(!visible)}
      className="focus-ring rounded-inner p-1.5 text-ink-subtle hover:bg-surface-muted hover:text-ink"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
