import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "../lib/icons";
import type { LucideIcon } from "../lib/icons";

const alertVariants = cva("w-full rounded-control border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "border-rule bg-surface-sunk text-ink-strong",
      destructive: "border-danger-border bg-danger-subtle text-danger-foreground",
      success: "border-success-border bg-success-subtle text-success-foreground",
      // Story 185 (RD-1.8) — the two semantic families that had tokens but no
      // Alert: callers were borrowing default/destructive instead.
      warning: "border-warning-border bg-warning-subtle text-warning-foreground",
      info: "border-info-border bg-info-subtle text-info-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

/**
 * Only `destructive` interrupts (role="alert"); every other variant is a
 * polite status. A caller can still override `role`.
 */
const ROLE_BY_VARIANT = {
  default: "status",
  success: "status",
  info: "status",
  warning: "status",
  destructive: "alert",
} as const;

const ICON_BY_VARIANT: Record<keyof typeof ROLE_BY_VARIANT, LucideIcon> = {
  default: InfoIcon,
  info: InfoIcon,
  success: SuccessIcon,
  warning: WarningIcon,
  destructive: ErrorIcon,
};

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  /**
   * Story 185 (RD-1.8) — an optional bold first line. Opt-in, like `icon`, so
   * the ~100 existing alerts (many laying out their own children with flex)
   * render exactly as before.
   */
  title?: React.ReactNode;
  /** `true` for the variant's own icon, or a specific icon. Decorative. */
  icon?: boolean | LucideIcon;
}

export function Alert({ className, variant, role, title, icon, children, ...props }: AlertProps) {
  const key = variant ?? "default";
  const Icon = icon === true ? ICON_BY_VARIANT[key] : icon || null;
  const structured = Boolean(Icon || title);
  return (
    <div
      role={role ?? ROLE_BY_VARIANT[key]}
      className={cn(alertVariants({ variant }), structured && "flex items-start gap-3", className)}
      {...props}
    >
      {structured ? (
        <>
          {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title && <p className="font-semibold">{title}</p>}
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  );
}
