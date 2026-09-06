import { BadRequestException } from "@nestjs/common";
import type { TicketStatus } from "@prisma/client";

/**
 * RM-01 — the single source of truth for which `TicketStatus` a ticket may
 * move to from its current one.
 *
 * Recon before writing this (see `.squad/plans/core-completion-roadmap/
 * RM-01-ticket-status-transitions.md`) found the repository's own existing
 * test suite (`tickets.service.spec.ts`'s "resolvedAt transitions (Story
 * 99)" describe block) already asserts, as correct, tested, required
 * behavior, free bidirectional movement between every pair it exercises —
 * including `IN_PROGRESS -> CLOSED` and `RESOLVED -> OPEN`, two "skip a
 * step" jumps the original speculative framing of this gap assumed were a
 * bug. No architecture doc, comment, or plan anywhere in this repository
 * defines a more restrictive lifecycle.
 *
 * Per the product owner's own explicit direction (confirmed rather than
 * guessed, given that evidence), this table is deliberately fully
 * permissive: every status may move to every other status, including
 * itself (a same-status `PATCH` is always a legal no-op, unchanged from
 * today). This does not change any current behavior — it gives it one
 * explicit, tested, centrally-located name instead of being merely
 * implicit in `UpdateTicketDto.status`'s `@IsEnum(TicketStatus)` accepting
 * any of the four values unconditionally. Narrowing this table later, if a
 * real product need is ever disclosed, is a deliberate one-line change
 * here — not a rewrite of `TicketsService.updateTicket`, which only ever
 * calls `assertValidTicketStatusTransition` and never encodes the graph
 * itself.
 */
export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  CLOSED: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
};

/**
 * Throws a `BadRequestException` naming the attempted transition when `to`
 * is not listed as reachable from `from` in `table`. `table` defaults to
 * the real, exported `TICKET_STATUS_TRANSITIONS` above — accepting it as a
 * parameter (rather than hard-coding the import inside this function) is
 * what lets this guard's own rejection behavior be unit-tested against a
 * deliberately narrow table, independent of whether the real production
 * table happens to allow everything (see `ticket-status-transitions.spec.ts`).
 */
export function assertValidTicketStatusTransition(
  from: TicketStatus,
  to: TicketStatus,
  table: Record<TicketStatus, TicketStatus[]> = TICKET_STATUS_TRANSITIONS,
): void {
  if (!table[from].includes(to)) {
    throw new BadRequestException(`Cannot move ticket from ${from} to ${to}`);
  }
}
