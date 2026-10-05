"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { UnassignedIcon } from "../lib/icons";

/**
 * Story 189 (RD-1.12) — a person's avatar: their image, or initials when there
 * is none (or it fails to load). Domain-free and translation-free: the name
 * and any presence text arrive from the caller.
 *
 * Presence is never colour-only: the dot is decorative, and the presence text
 * (`presenceLabel`, e.g. "Online") is appended to the accessible name.
 */
export type AvatarSize = "sm" | "md" | "lg";
export type AvatarPresence = "online" | "away" | "offline";

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The person's display name — the initials source and the accessible name. Always pass one. */
  name: string;
  src?: string | null;
  size?: AvatarSize;
  presence?: AvatarPresence;
  /** Translated presence text, appended to the accessible name ("Ada Lovelace, Online"). */
  presenceLabel?: string;
  /** The name is already visible beside the avatar: hide it from assistive tech. */
  decorative?: boolean;
  /**
   * Story 212 (PR-1.3) — `unassigned`: a dashed placeholder with a person
   * glyph instead of initials, for "nobody yet" (a ticket card's assignee).
   * `name` is then the accessible name ("Unassigned").
   */
  variant?: "person" | "unassigned";
}

const SIZE: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-caption",
  md: "h-8 w-8 text-caption",
  lg: "h-10 w-10 text-body",
};

const PRESENCE: Record<AvatarPresence, string> = {
  online: "bg-success-solid",
  away: "bg-warning-solid",
  offline: "bg-rule-strong",
};

function firstGrapheme(part: string): string {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(part);
    for (const { segment } of segments) {
      return segment;
    }
    return "";
  }
  return Array.from(part)[0] ?? "";
}

/** First grapheme of the first and last name parts ("Ada Lovelace" → "AL"). Arabic-safe. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  const first = firstGrapheme(parts[0]!);
  const last = parts.length > 1 ? firstGrapheme(parts[parts.length - 1]!) : "";
  return `${first}${last}`.toLocaleUpperCase();
}

export function Avatar({
  name,
  src,
  size = "md",
  presence,
  presenceLabel,
  decorative = false,
  variant = "person",
  className,
  ...props
}: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  const showImage = Boolean(src) && !failed;
  const label = presence && presenceLabel ? `${name}, ${presenceLabel}` : name;

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center rounded-pill font-medium",
        variant === "unassigned"
          ? "border border-dashed border-rule-control text-ink-subtle"
          : "bg-accent-surface text-accent-hover",
        SIZE[size],
        className,
      )}
      {...props}
    >
      {variant === "unassigned" ? (
        <UnassignedIcon aria-hidden="true" className="h-3/5 w-3/5" />
      ) : showImage ? (
        <img
          src={src!}
          alt=""
          className="h-full w-full rounded-pill object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
      {presence && (
        <span
          aria-hidden="true"
          data-presence={presence}
          className={cn(
            "absolute bottom-0 end-0 h-2.5 w-2.5 rounded-pill ring-2 ring-surface",
            PRESENCE[presence],
          )}
        />
      )}
    </span>
  );
}
