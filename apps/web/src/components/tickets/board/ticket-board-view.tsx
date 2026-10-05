"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Board,
  Button,
  EmptyState,
  FetchingIndicator,
  FilterSelect,
  ListToolbar,
  PageHeader,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  CloseIcon,
  TicketsIcon,
  showToast,
} from "@crm/ui";
import { useIsFetching } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoveTicketMutation } from "@/hooks/use-move-ticket";
import { useCurrentUserQuery, useCustomerQuery, useUsersQuery } from "@/hooks/use-tickets";
import { useTicketCategoriesQuery } from "@/hooks/use-ticket-categories";
import { useTicketLabels } from "@/hooks/use-ticket-labels";
import { useUrlFilters } from "@/lib/url-filters";
import { localeDirection } from "@/i18n/direction";
import type { TicketListItem, TicketStatus } from "@/lib/tickets-api";
import {
  BOARD_SORTS,
  BOARD_STATUSES,
  CLOSED_COLLAPSED_STORAGE_KEY,
  QUICK_VIEWS,
  activeFilterCount,
  parseBoardFilters,
  quickViewOf,
  readStorage,
  serializeBoardFilters,
  statusSpine,
  withQuickView,
  writeStorage,
  type BoardFilters,
  type BoardSort,
  type QuickView,
} from "./board-state";
import { TicketBoardColumn, type ColumnReport } from "./ticket-board-column";
import { TicketCard } from "./ticket-card";
import { BoardCard } from "./board-card";
import { ticketHref } from "@/components/tickets/ticket-neighbours";
import { columnCoordinates, needsConfirmation } from "./board-moves";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const ALL = "__all__";

function useMediaQuery(query: string, initial: boolean): boolean {
  const [matches, setMatches] = useState(initial);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** The pointer decides when there is one; the keyboard drag uses the card's rect. */
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : rectIntersection(args);
};

type MoveVia = "pointer" | "keyboard" | "menu";

/** How long a card the agent moved counts as their own change. */
const OWN_MOVE_MS = 45_000;

const MEASURE_COLUMNS_UP_FRONT = { droppable: { strategy: MeasuringStrategy.Always } };

const SILENT_ANNOUNCEMENTS = {
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

/**
 * Story 216 (PR-3.1, tickets-kanban-ux.md) — the Tickets board, the default
 * view of `/tickets` (decision PD-3): four status columns of cards under one
 * toolbar (search, quick views, filters, sort, summary), the Closed column
 * folded by default, and a column switcher below `md`.
 *
 * Every filter lives in the URL (`useUrlFilters`), with the list view's
 * parameter names, so a filtered board is shareable and survives reloads.
 * The search keeps the list's placeholder and on-blur/Enter commit.
 *
 * Story 217 (PR-3.2, tickets-kanban-ux.md §5) — cards move by pointer drag,
 * keyboard drag (the handle) or the "Move to" menu, all through one
 * `requestMove`: Open ↔ In progress is immediate, Resolved/Closed wait on
 * the card's confirm popover (PD-5). Moves are optimistic and roll back on
 * error with a toast keyed by the failure; every outcome is announced in a
 * polite live region, and a keyboard or menu move puts focus back on the
 * card in its new column. Below `md` there is no drag: the menu moves, and
 * the switcher follows the card to its new column.
 */
/** Story 222 — the board narrowed to one customer (from the customer page). */
function CustomerFilterChip({
  customerId,
  onRemove,
}: {
  customerId: string;
  onRemove: () => void;
}) {
  const t = useTranslations("tickets.board");
  const customer = useCustomerQuery(customerId);
  const name = customer.data?.displayName ?? t("customerFallback");
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-rule bg-surface py-0.5 pe-1 ps-3 text-caption text-ink">
      {t("customerFilter", { name })}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("customerFilterRemove", { name })}
        className="focus-ring inline-flex h-5 w-5 items-center justify-center rounded-pill text-ink-subtle hover:bg-surface-muted hover:text-ink"
      >
        <CloseIcon aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function TicketBoardView({ viewSwitcher }: { viewSwitcher?: ReactNode }) {
  const t = useTranslations("tickets.board");
  const tList = useTranslations("tickets.list");
  const tCommon = useTranslations("common");
  const labels = useTicketLabels();
  const errorMessage = useErrorMessage();
  const { locale } = useParams<{ locale: string }>();
  const dir = localeDirection(locale);
  // Below `md` the board shows one column at a time (tickets-kanban-ux.md §7).
  const desktop = useMediaQuery("(min-width: 768px)", true);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", false);
  const moveMutation = useMoveTicketMutation();

  const [filters, setFilters] = useUrlFilters(parseBoardFilters, serializeBoardFilters);
  const currentUserQuery = useCurrentUserQuery();
  const usersQuery = useUsersQuery();
  const categoriesQuery = useTicketCategoriesQuery();
  const fetching = useIsFetching({ queryKey: ["tickets", "board"] }) > 0;
  const currentUserId = currentUserQuery.data?.id;

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data ?? []) map.set(user.id, user.fullName);
    return map;
  }, [usersQuery.data]);
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) map.set(category.id, category.name);
    return map;
  }, [categoriesQuery.data]);

  // The Closed column starts folded; the choice is remembered per browser.
  const [closedCollapsed, setClosedCollapsed] = useState(true);
  useEffect(() => {
    setClosedCollapsed(readStorage(CLOSED_COLLAPSED_STORAGE_KEY) !== "false");
  }, []);
  function toggleClosed() {
    setClosedCollapsed((value) => {
      writeStorage(CLOSED_COLLAPSED_STORAGE_KEY, String(!value));
      return !value;
    });
  }

  const [mobileStatus, setMobileStatus] = useState<TicketStatus>("OPEN");
  const [reports, setReports] = useState<Partial<Record<TicketStatus, ColumnReport>>>({});
  const onReport = useCallback((report: ColumnReport) => {
    setReports((current) => {
      const previous = current[report.status];
      if (previous && previous.total === report.total && previous.shown === report.shown) {
        return current;
      }
      return { ...current, [report.status]: report };
    });
  }, []);

  const totals = BOARD_STATUSES.map((status) => reports[status]?.total);
  const known = totals.every((total) => total !== undefined);
  const grandTotal = known
    ? totals.reduce<number>((sum, total) => sum + (total ?? 0), 0)
    : undefined;
  const filterCount = activeFilterCount(filters);
  const quickView = quickViewOf(filters, currentUserId);

  function update(next: Partial<BoardFilters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  const assigneeNameOf = (ticket: TicketListItem) =>
    ticket.assignedToUserId
      ? (userNameById.get(ticket.assignedToUserId) ?? t("unknownAgent"))
      : null;

  // --- Moving cards (Story 217) ---------------------------------------------
  const [dragging, setDragging] = useState<TicketListItem | null>(null);
  const [overStatus, setOverStatus] = useState<TicketStatus | null>(null);
  const [confirm, setConfirm] = useState<{
    ticket: TicketListItem;
    to: TicketStatus;
    via: MoveVia;
  } | null>(null);
  // Where focus should land once the moved card renders in its new column.
  const [focusRequest, setFocusRequest] = useState<{ id: string; status: TicketStatus } | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState({ text: "", key: 0 });
  const announce = useCallback(
    (text: string) => setAnnouncement((current) => ({ text, key: current.key + 1 })),
    [],
  );

  const moveFailureReason = (error: unknown) =>
    error instanceof ApiError && error.status === 404
      ? t("moveErrors.notFound")
      : errorMessage(error, {
          forbidden: t("moveErrors.forbidden"),
          generic: t("moveErrors.generic"),
        });

  // Story 218 — the agent's own recent moves never get the change cue.
  const ownMoves = useRef(new Set<string>()).current;

  const performMove = (ticket: TicketListItem, to: TicketStatus, via: MoveVia) => {
    const status = labels.status(to);
    ownMoves.add(ticket.id);
    window.setTimeout(() => ownMoves.delete(ticket.id), OWN_MOVE_MS);
    moveMutation.mutate(
      { ticket, to },
      {
        onSuccess: (result) => {
          announce(t("announce.moved", { subject: ticket.subject, status }));
          // Last write wins (§6 "Conflicts"): say so when it overrode a change.
          if (result?.collided) showToast(t("moveCollision"), { tone: "info" });
        },
        onError: (error) => {
          const reason = moveFailureReason(error);
          setFocusRequest(null);
          showToast(reason, { tone: "error" });
          announce(t("announce.failed", { subject: ticket.subject, reason }));
        },
      },
    );
    if (via !== "pointer") setFocusRequest({ id: ticket.id, status: to });
    if (!desktop) setMobileStatus(to);
  };

  const requestMove = (ticket: TicketListItem, to: TicketStatus, via: MoveVia) => {
    if (to === ticket.status) {
      announce(t("announce.cancelled"));
      return;
    }
    if (needsConfirmation(to)) setConfirm({ ticket, to, via });
    else performMove(ticket, to, via);
  };
  // The card is memoized; its callbacks read the latest state through a ref.
  const latest = useRef({ requestMove, performMove, confirm });
  latest.current = { requestMove, performMove, confirm };

  const onMoveRequest = useCallback(
    (ticket: TicketListItem, to: TicketStatus) => latest.current.requestMove(ticket, to, "menu"),
    [],
  );
  const onConfirm = useCallback(() => {
    const pending = latest.current.confirm;
    if (!pending) return;
    setConfirm(null);
    // Focus was in the popover, so it follows the card even after a pointer drop.
    latest.current.performMove(pending.ticket, pending.to, "menu");
  }, []);
  const onCancel = useCallback(() => {
    if (!latest.current.confirm) return;
    setConfirm(null);
    announce(t("announce.cancelled"));
  }, [announce, t]);
  const onFocused = useCallback(() => setFocusRequest(null), []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );

  function onDragStart(event: DragStartEvent) {
    const ticket = (event.active.data.current?.ticket as TicketListItem | undefined) ?? null;
    setDragging(ticket);
    // Announced once the drag is measured (two frames), so "Picked up" also
    // means the arrow keys are ready to move the card.
    if (ticket) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => announce(t("announce.pickedUp", { subject: ticket.subject }))),
      );
    }
  }
  function onDragOver(event: DragOverEvent) {
    const over = (event.over?.id as TicketStatus | undefined) ?? null;
    const previous = overStatus;
    setOverStatus(over);
    const ticket = event.active.data.current?.ticket as TicketListItem | undefined;
    const subject = ticket?.subject;
    // The first "over" is the card's own column, right after pick-up: saying
    // it would cut off the "Picked up…" instructions.
    if (previous === null && over === ticket?.status) return;
    if (subject) {
      announce(
        over
          ? t("announce.over", { subject, status: labels.status(over) })
          : t("announce.notOver", { subject }),
      );
    }
  }
  function onDragEnd(event: DragEndEvent) {
    const ticket = event.active.data.current?.ticket as TicketListItem | undefined;
    setDragging(null);
    setOverStatus(null);
    if (!ticket) return;
    const via: MoveVia = event.activatorEvent instanceof KeyboardEvent ? "keyboard" : "pointer";
    if (!event.over) {
      announce(t("announce.cancelled"));
      return;
    }
    requestMove(ticket, event.over.id as TicketStatus, via);
  }
  function onDragCancel() {
    setDragging(null);
    setOverStatus(null);
    announce(t("announce.cancelled"));
  }

  // Story 220 — cards open the ticket with this board's filters, for prev/next.
  const boardQuery = serializeBoardFilters(filters);
  const renderCard = (ticket: TicketListItem, changed: boolean) => (
    <BoardCard
      changed={changed}
      href={ticketHref(locale, ticket.id, { from: "board", query: boardQuery })}
      ticket={ticket}
      locale={locale}
      assigneeName={assigneeNameOf(ticket)}
      draggable={desktop}
      confirming={confirm?.ticket.id === ticket.id ? confirm.to : null}
      focusRequested={focusRequest?.id === ticket.id && focusRequest.status === ticket.status}
      onMoveRequest={onMoveRequest}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onFocused={onFocused}
    />
  );

  const countDeltaOf = (status: TicketStatus) =>
    dragging && overStatus && overStatus !== dragging.status
      ? status === dragging.status
        ? -1
        : status === overStatus
          ? 1
          : 0
      : 0;

  const filtersNode = (
    <>
      <FilterSelect
        allValue={ALL}
        allLabel={tList("filterAll")}
        label={tList("filterPriority")}
        value={filters.priority ?? ALL}
        onChange={(value) =>
          update({ priority: value === ALL ? undefined : (value as BoardFilters["priority"]) })
        }
        options={PRIORITIES}
        renderLabel={labels.priority}
      />
      <FilterSelect
        allValue={ALL}
        allLabel={tList("filterAll")}
        label={tList("filterAssignedAgent")}
        value={filters.assignedToUserId ?? ALL}
        onChange={(value) =>
          update({ assignedToUserId: value === ALL ? undefined : value, unassigned: undefined })
        }
        options={(usersQuery.data ?? []).map((user) => user.id)}
        renderLabel={(id) => userNameById.get(id) ?? id}
      />
      <FilterSelect
        allValue={ALL}
        allLabel={tList("filterAll")}
        label={tList("filterCategory")}
        value={filters.categoryId ?? ALL}
        onChange={(value) => update({ categoryId: value === ALL ? undefined : value })}
        options={(categoriesQuery.data ?? []).map((category) => category.id)}
        renderLabel={(id) => categoryNameById.get(id) ?? id}
      />
      {/* The same control as the filters beside it (FilterSelect's markup),
          without an "All" option: a sort always has a value. */}
      <label className="flex flex-col gap-tight text-xs text-ink-muted">
        {t("sortLabel")}
        <Select
          value={filters.sort}
          onValueChange={(value) => update({ sort: value as BoardSort })}
        >
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[10rem]" aria-label={t("sortLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOARD_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {t(`sort.${sort}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </>
  );

  const everythingEmpty = known && grandTotal === 0;
  const filteredEmpty = everythingEmpty && filterCount > 0;

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title={tList("title")}
        actions={
          <>
            <FetchingIndicator active={fetching} label={tCommon("updating")} />
            {viewSwitcher}
          </>
        }
      />

      <ListToolbar
        search={{
          value: filters.search ?? "",
          onCommit: (value) => update({ search: value.trim() || undefined }),
          label: tList("searchLabel"),
          placeholder: tList("searchPlaceholder"),
          clearLabel: t("clearSearch"),
        }}
        filters={filtersNode}
        filterCount={filterCount}
        filtersLabel={t("filters")}
        closeLabel={t("closeFilters")}
        summary={
          grandTotal !== undefined
            ? filters.risk
              ? t("summaryAtRisk", { count: grandTotal })
              : t("summary", { count: grandTotal })
            : undefined
        }
        onClearAll={() => setFilters({ sort: filters.sort })}
        clearAllLabel={t("clearAll")}
      >
        {filters.customerId && (
          <CustomerFilterChip
            customerId={filters.customerId}
            onRemove={() => update({ customerId: undefined })}
          />
        )}
        <SegmentedControl
          aria-label={t("quickViewLabel")}
          dir={dir}
          size="sm"
          options={QUICK_VIEWS.filter((view) => view !== "mine" || currentUserId).map((view) => ({
            value: view,
            label: t(`quick.${view}`),
          }))}
          value={quickView}
          onValueChange={(value) =>
            setFilters((current) => withQuickView(current, value as QuickView, currentUserId))
          }
        />
      </ListToolbar>

      {/* Story 218 — the columns stay mounted (hidden) under the empty state:
          their queries keep refreshing, so a refetch that briefly reads 0
          everywhere can never strand the board on "no tickets". */}
      {filteredEmpty && (
        <EmptyState
          icon={<TicketsIcon className="h-5 w-5" />}
          title={t("filteredEmpty")}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilters({ sort: filters.sort })}
            >
              {t("clearAll")}
            </Button>
          }
        />
      )}
      <div
        hidden={filteredEmpty}
        className={filteredEmpty ? "hidden" : "flex flex-col gap-section"}
      >
        {!desktop && (
          <SegmentedControl
            aria-label={t("columnSwitcher")}
            dir={dir}
            size="sm"
            fill
            className="sticky top-0 z-10"
            options={BOARD_STATUSES.map((status) => ({
              value: status,
              label: labels.status(status),
              count: reports[status]?.total,
              dot: statusSpine(status).dot,
            }))}
            value={mobileStatus}
            onValueChange={(value) => setMobileStatus(value as TicketStatus)}
          />
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          // The columns are measured before a drag starts, so the first arrow
          // key of a keyboard drag always finds them (four rects; cheap).
          measuring={MEASURE_COLUMNS_UP_FRONT}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          accessibility={{
            screenReaderInstructions: { draggable: t("announce.instructions") },
            // dnd-kit's own region is assertive; the spec asks for polite,
            // so every drag message goes through the board's region below.
            announcements: SILENT_ANNOUNCEMENTS,
          }}
        >
          <Board
            aria-label={t("boardLabel")}
            className="md:h-[calc(100dvh-17rem)] md:min-h-[28rem]"
          >
            {BOARD_STATUSES.map((status) => (
              <TicketBoardColumn
                key={status}
                status={status}
                filters={filters}
                collapsed={desktop && status === "CLOSED" && closedCollapsed}
                onToggleCollapsed={status === "CLOSED" && desktop ? toggleClosed : undefined}
                renderCard={renderCard}
                onReport={onReport}
                hiddenBelowMd={!desktop && status !== mobileStatus}
                fullWidth={!desktop}
                countDelta={countDeltaOf(status)}
                dragSource={dragging?.status ?? null}
                paused={dragging !== null}
                ownMoves={ownMoves}
              />
            ))}
          </Board>
          <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
            {dragging && (
              <TicketCard
                ticket={dragging}
                locale={locale}
                assigneeName={assigneeNameOf(dragging)}
                className="cursor-grabbing shadow-overlay motion-safe:scale-[1.02]"
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>
      {/* Always mounted, so the first message lands in an existing region. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span key={announcement.key}>{announcement.text}</span>
      </div>
    </section>
  );
}
