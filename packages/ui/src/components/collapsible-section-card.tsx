"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { ChevronDownIcon } from "../lib/icons";
import { Card, CardTitle, type CardProps, type CardTitleLevel } from "./card";

/**
 * Story 203 (RD-3.3) — `SectionCard`'s collapsible mode, kept in its own
 * client module so `card.tsx` stays hook-free and usable from server
 * components. `SectionCard` delegates here only when `collapsible` is set.
 *
 * The WAI-ARIA disclosure pattern: the heading keeps its level and contains a
 * button (`aria-expanded`, `aria-controls`) whose text is the title, so the
 * heading's accessible name is unchanged; the body is a sibling `<div>` that
 * is `hidden` while collapsed. Open by default; the state is client-only.
 *
 * The chevron points down when open and toward the inline end when closed
 * (a disclosure triangle): `-rotate-90` in LTR, `rotate-90` in RTL.
 */
export interface CollapsibleSectionCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title: React.ReactNode;
  headingLevel: CardTitleLevel;
  actions?: React.ReactNode;
  elevation?: CardProps["elevation"];
  defaultOpen?: boolean;
}

export function CollapsibleSectionCard({
  title,
  headingLevel,
  actions,
  elevation,
  defaultOpen = true,
  className,
  children,
  ...props
}: CollapsibleSectionCardProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const bodyId = React.useId();

  const heading = (
    <CardTitle as={headingLevel}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex w-full items-center justify-between gap-inline rounded-inner text-start"
      >
        <span className="min-w-0">{title}</span>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 shrink-0 text-ink-subtle transition-transform duration-fast",
            !open && "-rotate-90 rtl:rotate-90",
          )}
          aria-hidden="true"
        />
      </button>
    </CardTitle>
  );

  return (
    <Card elevation={elevation} className={cn("p-surface", className)} {...props}>
      {actions ? (
        <div className="flex items-start justify-between gap-inline">
          <div className="min-w-0 flex-1">{heading}</div>
          <div className="flex shrink-0 items-center gap-inline">{actions}</div>
        </div>
      ) : (
        heading
      )}
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </Card>
  );
}
