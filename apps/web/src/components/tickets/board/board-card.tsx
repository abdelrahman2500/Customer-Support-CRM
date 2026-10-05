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
  Popover,
  PopoverAnchor,
  PopoverContent,
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
 * A move into Resolved or Closed waits on an inline popover anchored to the
 * card (PD-5: the customer is notified); focus starts on its confirm
 * button, and Escape / Cancel / clicking away leaves the card where it was.
 */
export const BoardCard = memo(function BoardCard({
  ticket,
  locale,
  assigneeName,
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
    <Popover
      open={confirming !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <PopoverAnchor asChild>
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
            actions={actions}
            className={cn(
              isDragging &&
                "border-dashed border-rule-strong bg-surface-muted opacity-50 shadow-none",
              // With reduced motion only the colour remains (§6).
              changed &&
                "motion-safe:animate-change-cue motion-reduce:ring-2 motion-reduce:ring-accent/50",
            )}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        aria-labelledby={questionId}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusTarget()?.focus();
        }}
        className="flex flex-col gap-stack"
      >
        {confirming && (
          <>
            <p id={questionId} className="text-body-sm text-ink">
              <span className="font-medium">{t(`confirm.${confirming}.question`)}</span>{" "}
              <span className="text-ink-muted">{t("confirm.notified")}</span>
            </p>
            <div className="flex justify-end gap-tight">
              <Button type="button" size="sm" onClick={onConfirm}>
                {t(`confirm.${confirming}.action`)}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                {t("confirm.cancel")}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
});
