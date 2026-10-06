"use client";

import { memo, useEffect, useId, useRef, type KeyboardEventHandler } from "react";
import { useTranslations } from "next-intl";
import { useDraggable } from "@dnd-kit/core";
import {
  Button,
  DragHandleIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  MoreActionsIcon,
  cn,
} from "@crm/ui";
import type { TicketListItem, TicketStatus } from "@/lib/tickets-api";
import { useTicketLabels } from "@/hooks/use-ticket-labels";
import { BOARD_STATUSES } from "./board-state";
import { TicketCard } from "./ticket-card";

export interface BoardCardProps {
  ticket: TicketListItem;
  locale: string;
  assigneeName: string | null;
  /** Story 220 — the ticket link, carrying the board's filters. */
  href?: string;
  /** Pointer and keyboard drag (≥ md); phones move with the menu only. */
  draggable: boolean;
  /** The status this card waits to be confirmed into (Resolved/Closed), if any. */
  confirming: TicketStatus | null;
  /** Story 218 — someone else just changed this card (a brief accent pulse). */
  changed?: boolean;
  /** True once, after a keyboard or menu move landed this card here. */
  focusRequested: boolean;
  onMoveRequest: (ticket: TicketListItem, to: TicketStatus) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onFocused: () => void;
}

/**
 * Story 217 (PR-3.2, tickets-kanban-ux.md §5) — a card that can be moved.
 *
 * Three paths, one `onMoveRequest`:
 * - pointer drag on the whole card (mouse after 6px, touch after a 200ms
 *   press — the board's sensors), so a click still opens the ticket;
 * - keyboard drag on the handle ("Move {subject}"): only the handle takes
 *   the drag keys, so Enter on the subject link still opens the ticket;
 * - the "⋯" menu's "Move to" items, at every width (the only path on
 *   phones, and the screen-reader-friendly one).
 *
 * A move into Resolved or Closed waits on a confirmation (PD-5: the customer
 * is notified); focus starts on its confirm button, and Escape / Cancel
 * leaves the card where it was.
 *
 * Demo hardening — the confirmation opens inside the card, under its
 * content, instead of a popover: below the card it covered the next card in
 * the column, beside it the first card of the next column. Inline, it covers
 * nothing and is unmistakably about this card.
 */
export const BoardCard = memo(function BoardCard({
  ticket,
  locale,
  assigneeName,
  href,
  draggable,
  confirming,
  focusRequested,
  changed = false,
  onMoveRequest,
  onConfirm,
  onCancel,
  onFocused,
}: BoardCardProps) {
  const t = useTranslations("tickets.board");
  const labels = useTicketLabels();
  const questionId = useId();
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLButtonElement | null>(null);
  // A "Move to" pick is carried out once the menu has finished closing: the
  // confirm popover then never overlaps the closing menu, and focus goes to
  // the card's new place (or the popover) instead of back to the trigger.
  const pickedStatus = useRef<TicketStatus | null>(null);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
    disabled: !draggable,
  });
  const { onKeyDown, ...pointerListeners } = listeners ?? {};
  const onHandleKeyDown = onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined;

  const focusTarget = () => (draggable ? handleRef.current : null) ?? menuRef.current;

  // The confirmation takes focus when it opens and hands it back to the card
  // when it closes (what the popover's own focus management used to do).
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    wasConfirming.current = wasConfirming.current || confirming !== null;
    if (!confirming && !wasConfirming.current) return;
    // Two frames: after a keyboard drop, dnd-kit hands focus back to the
    // drag handle in its own animation frame, which would otherwise win.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (confirming) {
          confirmRef.current?.focus();
        } else {
          focusTarget()?.focus();
          wasConfirming.current = false;
        }
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focusTarget reads refs only
  }, [confirming]);

  // Escape cancels from anywhere while the confirmation is open, as the
  // popover's dismissable layer did (focus may still be on the menu).
  useEffect(() => {
    if (!confirming) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming, onCancel]);

  useEffect(() => {
    if (!focusRequested) return;
    const target = focusTarget();
    target?.focus();
    target?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    onFocused();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per request
  }, [focusRequested]);

  const actions = (
    <span className="flex items-center gap-0.5">
      {draggable && (
        <button
          type="button"
          ref={(node) => {
            handleRef.current = node;
            setActivatorNodeRef(node);
          }}
          {...attributes}
          onKeyDown={onHandleKeyDown}
          aria-label={t("moveHandle", { subject: ticket.subject })}
          className="focus-ring inline-flex h-7 w-6 cursor-grab items-center justify-center rounded-inner text-ink-subtle hover:bg-surface-muted hover:text-ink active:cursor-grabbing"
        >
          <DragHandleIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={menuRef}
          aria-label={t("cardActions", { subject: ticket.subject })}
          className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-inner text-ink-subtle hover:bg-surface-muted hover:text-ink"
        >
          <MoreActionsIcon aria-hidden="true" className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            const status = pickedStatus.current;
            if (status) {
              event.preventDefault();
              pickedStatus.current = null;
              onMoveRequest(ticket, status);
            }
          }}
        >
          <DropdownMenuLabel>{t("moveTo")}</DropdownMenuLabel>
          {BOARD_STATUSES.filter((status) => status !== ticket.status).map((status) => (
            <DropdownMenuItem
              key={status}
              onSelect={() => {
                pickedStatus.current = status;
              }}
            >
              {labels.status(status)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? pointerListeners : {})}
      data-changed={changed || undefined}
      className="touch-manipulation"
    >
      <TicketCard
        ticket={ticket}
        locale={locale}
        assigneeName={assigneeName}
        href={href}
        actions={actions}
        className={cn(
          isDragging && "border-dashed border-rule-strong bg-surface-muted opacity-50 shadow-none",
          // With reduced motion only the colour remains (§6).
          changed &&
            "motion-safe:animate-change-cue motion-reduce:ring-2 motion-reduce:ring-accent/50",
          confirming && "rounded-b-none",
        )}
      />
      {confirming && (
        // A non-modal dialog, named by its question (Escape: see above).
        <div
          role="dialog"
          aria-labelledby={questionId}
          // Not a drag start: the buttons are inside the draggable card.
          onPointerDown={(event) => event.stopPropagation()}
          className="flex flex-col gap-stack rounded-b-surface border border-t-0 border-rule bg-surface-raised p-3 shadow-sm"
        >
          <p id={questionId} className="text-body-sm text-ink">
            <span className="font-medium">{t(`confirm.${confirming}.question`)}</span>{" "}
            <span className="text-ink-muted">{t("confirm.notified")}</span>
          </p>
          <div className="flex justify-end gap-tight">
            <Button ref={confirmRef} type="button" size="sm" onClick={onConfirm}>
              {t(`confirm.${confirming}.action`)}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              {t("confirm.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
