import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateTicketDto } from "./dto/create-ticket.dto";
import type { UpdateTicketDto } from "./dto/update-ticket.dto";
import type { ListTicketsQueryDto } from "./dto/list-tickets-query.dto";
import type { CreateTicketNoteDto } from "./dto/create-ticket-note.dto";
import type { PortalCreateTicketDto } from "../portal/dto/portal-create-ticket.dto";
import type { SubmitCsatDto } from "../portal/dto/submit-csat.dto";
import {
  TICKET_CREATED_EVENT,
  TICKET_UPDATED_EVENT,
  TICKET_RECATEGORIZED_EVENT,
  TICKET_NOTE_ADDED_EVENT,
} from "./tickets.events";
import type {
  TicketCreatedEvent,
  TicketUpdatedEvent,
  TicketRecategorizedEvent,
  TicketNoteAddedEvent,
} from "./tickets.events";

export interface TicketSummary {
  id: string;
  subject: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  customerId: string;
  contactId: string | null;
  departmentId: string | null;
  assignedToUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Story 23 — the same shape `SlaTargetsService.getSlaTargetForTicket`
 * (`sla-targets.service.ts`) returns, minus `ticketId` (redundant once
 * embedded under the ticket it belongs to). Declared here rather than
 * imported from the `sla-policies` module so `TicketsService` gains no new
 * cross-module runtime dependency — only a structurally-matching type.
 */
export interface TicketSlaTargetSummary {
  id: string;
  slaPolicyId: string;
  responseTargetAt: Date;
  resolutionTargetAt: Date;
}

export interface TicketListItem extends TicketSummary {
  slaTarget: TicketSlaTargetSummary | null;
}

export interface TicketHistoryEntrySummary {
  id: string;
  eventType: string;
  actorUserId: string | null;
  snapshot: unknown;
  createdAt: Date;
}

export interface TicketNoteSummary {
  id: string;
  ticketId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
}

export interface TicketCsatSummary {
  id: string;
  ticketId: string;
  submittedByContactId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

/**
 * Owns the `ticketing` schema — see docs/architecture/03-domain-boundaries.md
 * ("Ticketing"). CASL-based per-record visibility is still explicitly
 * deferred (see Story 07's "Settled decisions") — every authorization/
 * scoping decision here is branch-level only, via `TenantContext`, exactly
 * like `CustomersService`. Domain-event emission (`ticket.created`/
 * `ticket.updated`) was deferred by Story 07 and is implemented by Story 08
 * (see ./tickets.events.ts) — `ticket.escalated` and every subscriber
 * remain deferred past Story 08 too.
 *
 * Unlike `CustomersService`, a `Ticket` cross-references three other
 * domains at once (`Customer`/`Contact` from Customer Management,
 * `Department`/`User` from Identity & Access). Every one of those
 * references is verified to belong to the caller's active branch (and, for
 * `contactId`, to the specified customer) before any write — never merely
 * stamping the correct `branchId` on the `Ticket` itself while trusting a
 * cross-domain id at face value.
 */
@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTicket(dto: CreateTicketDto): Promise<TicketSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, branchId },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.contactId, customerId: dto.customerId },
      });
      if (!contact) {
        throw new NotFoundException("Contact not found");
      }
    }

    if (dto.departmentId) {
      await this.requireDepartmentInScope(dto.departmentId, branchId);
    }

    if (dto.assignedToUserId) {
      await this.requireUserInScope(dto.assignedToUserId, branchId);
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        branchId,
        customerId: dto.customerId,
        contactId: dto.contactId ?? null,
        departmentId: dto.departmentId ?? null,
        assignedToUserId: dto.assignedToUserId ?? null,
        subject: dto.subject,
        category: dto.category ?? null,
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      },
    });
    const summary = toTicketSummary(ticket);
    this.eventEmitter.emit(TICKET_CREATED_EVENT, {
      ticket: summary,
      actorUserId: this.tenantContext.userId,
    } satisfies TicketCreatedEvent);
    return summary;
  }

  /**
   * Story 23 — mechanical, same-response-shape extension: optional equality
   * filters on already-existing scalar fields, an optional sort choice on
   * the two timestamp columns this story also exposes on `TicketSummary`
   * (Task 1), and the ticket's already-existing `slaTarget` relation
   * eager-loaded (no new query, no new table — see the plan's Design item
   * 3). No search, no pagination — neither has any existing precedent in
   * this codebase to extend (see `ListTicketsQueryDto`'s own doc comment).
   */
  async listTickets(query: ListTicketsQueryDto = {}): Promise<TicketListItem[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const sortBy = query.sortBy ?? "createdAt";
    const sortDir = query.sortDir ?? "asc";
    const where: Prisma.TicketWhereInput = {
      branchId,
      ...(await this.resolveDepartmentVisibilityFilter()),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.priority !== undefined ? { priority: query.priority } : {}),
      ...(query.category !== undefined ? { category: query.category } : {}),
      ...(query.assignedToUserId !== undefined
        ? { assignedToUserId: query.assignedToUserId }
        : {}),
    };
    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      include: { slaTarget: true },
    });
    return tickets.map((ticket) => ({
      ...toTicketSummary(ticket),
      slaTarget: ticket.slaTarget
        ? {
            id: ticket.slaTarget.id,
            slaPolicyId: ticket.slaTarget.slaPolicyId,
            responseTargetAt: ticket.slaTarget.responseTargetAt,
            resolutionTargetAt: ticket.slaTarget.resolutionTargetAt,
          }
        : null,
    }));
  }

  async getTicket(id: string): Promise<TicketSummary> {
    const ticket = await this.findTicketInScope(id);
    return toTicketSummary(ticket);
  }

  async updateTicket(id: string, dto: UpdateTicketDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const existing = await this.findTicketInScope(id);

    if (dto.departmentId !== undefined) {
      await this.requireDepartmentInScope(dto.departmentId, branchId);
      await this.requireAllowedDepartmentReassignment(dto.departmentId);
    }
    if (dto.assignedToUserId !== undefined) {
      await this.requireUserInScope(dto.assignedToUserId, branchId);
    }

    const isRecategorized =
      (dto.category !== undefined && dto.category !== existing.category) ||
      (dto.priority !== undefined && dto.priority !== existing.priority) ||
      (dto.departmentId !== undefined && dto.departmentId !== existing.departmentId);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.assignedToUserId !== undefined
          ? { assignedToUserId: dto.assignedToUserId }
          : {}),
      },
    });
    const summary = toTicketSummary(updated);
    this.eventEmitter.emit(TICKET_UPDATED_EVENT, {
      ticket: summary,
      actorUserId: this.tenantContext.userId,
    } satisfies TicketUpdatedEvent);
    if (isRecategorized) {
      this.eventEmitter.emit(TICKET_RECATEGORIZED_EVENT, {
        ticket: summary,
        actorUserId: this.tenantContext.userId,
      } satisfies TicketRecategorizedEvent);
    }
    return { id };
  }

  async getTicketHistory(id: string): Promise<TicketHistoryEntrySummary[]> {
    await this.findTicketInScope(id);
    const entries = await this.prisma.ticketHistoryEntry.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
    });
    return entries.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      actorUserId: entry.actorUserId,
      snapshot: entry.snapshot,
      createdAt: entry.createdAt,
    }));
  }

  async getTicketNotes(id: string): Promise<TicketNoteSummary[]> {
    await this.findTicketInScope(id);
    const notes = await this.prisma.ticketNote.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
    });
    return notes.map((note) => ({
      id: note.id,
      ticketId: note.ticketId,
      authorUserId: note.authorUserId,
      body: note.body,
      createdAt: note.createdAt,
    }));
  }

  async createTicketNote(id: string, dto: CreateTicketNoteDto): Promise<{ id: string }> {
    await this.findTicketInScope(id);
    const authorUserId = this.requireAuthenticatedUserId();

    const note = await this.prisma.ticketNote.create({
      data: { ticketId: id, authorUserId, body: dto.body },
    });
    const summary: TicketNoteSummary = {
      id: note.id,
      ticketId: note.ticketId,
      authorUserId: note.authorUserId,
      body: note.body,
      createdAt: note.createdAt,
    };
    this.eventEmitter.emit(TICKET_NOTE_ADDED_EVENT, {
      ticketId: id,
      note: summary,
    } satisfies TicketNoteAddedEvent);
    return { id: note.id };
  }

  /** Agent-facing, read-only — mirrors `getTicketHistory`'s exact scoping
   * pattern. Returns `null` when no feedback has been submitted yet (not
   * an error, same convention as every other "nothing yet" list/lookup in
   * this codebase). */
  async getCsatForTicket(id: string): Promise<TicketCsatSummary | null> {
    await this.findTicketInScope(id);
    const response = await this.prisma.ticketCsatResponse.findUnique({ where: { ticketId: id } });
    return response ? toCsatSummary(response) : null;
  }

  // ---------------------------------------------------------------------
  // Story 53 — Customer Portal (customer-scoped, no TenantContext)
  //
  // Branch scoping for a portal-authenticated request is derived
  // transitively through the Contact -> Customer relation, never through
  // `TenantContext` (which stays exactly what it already was: the
  // agent-audience branch-scoping mechanism) — see the plan's Design item
  // 2. None of the existing branch-scoped methods above are touched.
  // ---------------------------------------------------------------------

  /**
   * The only way a portal Contact creates a ticket. `actorUserId` on the
   * emitted event is always `null` — a Contact is not an agent `User` (and
   * is not a valid `identity.users` foreign key), mirroring
   * `TicketEscalatedEvent`'s existing "no human actor" precedent (plan
   * Design item 3).
   */
  async createTicketForContact(
    contactId: string,
    dto: PortalCreateTicketDto,
  ): Promise<TicketSummary> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: { customer: true },
    });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        branchId: contact.customer.branchId,
        customerId: contact.customerId,
        contactId: contact.id,
        subject: dto.subject,
        category: dto.category ?? null,
      },
    });
    const summary = toTicketSummary(ticket);
    this.eventEmitter.emit(TICKET_CREATED_EVENT, {
      ticket: summary,
      actorUserId: null,
    } satisfies TicketCreatedEvent);
    return summary;
  }

  /**
   * Every ticket belonging to a Customer, newest first — a deliberate
   * deviation from `listTickets`'s own `createdAt asc` default (plan Design
   * item 8): a customer-facing "my tickets" view reads naturally
   * newest-first, and this is a new, separate list, not an extension of the
   * agent one. Scoped by `customerId` alone (docs/architecture/08-supporting-domains.md:
   * "every portal query adds `customerId = currentCustomer.id`" — every
   * contact at a Customer sees that Customer's tickets, not only ones they
   * personally opened).
   */
  async listTicketsForCustomer(customerId: string): Promise<TicketSummary[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    return tickets.map(toTicketSummary);
  }

  async getTicketForCustomer(id: string, customerId: string): Promise<TicketSummary> {
    const ticket = await this.findTicketInCustomerScope(id, customerId);
    return toTicketSummary(ticket);
  }

  async getTicketHistoryForCustomer(
    id: string,
    customerId: string,
  ): Promise<TicketHistoryEntrySummary[]> {
    await this.findTicketInCustomerScope(id, customerId);
    const entries = await this.prisma.ticketHistoryEntry.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
    });
    return entries.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      actorUserId: entry.actorUserId,
      snapshot: entry.snapshot,
      createdAt: entry.createdAt,
    }));
  }

  // ---------------------------------------------------------------------
  // Story 55 — Customer Portal — Ticket CSAT / Feedback (customer-scoped)
  // ---------------------------------------------------------------------

  /**
   * Feedback is only accepted once the ticket is `RESOLVED` or `CLOSED`
   * (plan Design item 2) and exactly once per ticket (plan Design item 1,
   * enforced by the `@@unique([ticketId])` constraint — a second attempt
   * is translated to `ConflictException`, mirroring
   * `CustomersService.createContact`'s own P2002-translation precedent).
   */
  async submitCsatForCustomer(
    ticketId: string,
    customerId: string,
    contactId: string,
    dto: SubmitCsatDto,
  ): Promise<{ id: string }> {
    const ticket = await this.findTicketInCustomerScope(ticketId, customerId);
    if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
      throw new BadRequestException(
        "Feedback can only be submitted once the ticket is resolved or closed",
      );
    }

    try {
      const response = await this.prisma.ticketCsatResponse.create({
        data: {
          ticketId,
          submittedByContactId: contactId,
          rating: dto.rating,
          comment: dto.comment ?? null,
        },
      });
      return { id: response.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Feedback has already been submitted for this ticket");
      }
      throw error;
    }
  }

  async getCsatForCustomer(
    ticketId: string,
    customerId: string,
  ): Promise<TicketCsatSummary | null> {
    await this.findTicketInCustomerScope(ticketId, customerId);
    const response = await this.prisma.ticketCsatResponse.findUnique({
      where: { ticketId },
    });
    return response ? toCsatSummary(response) : null;
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  /** Mirrors `findTicketInScope` exactly, scoped by `customerId` instead of
   * `branchId` — 404 masks both "doesn't exist" and "belongs to a
   * different Customer" identically, the same convention every other
   * scoped lookup in this codebase already follows. */
  private async findTicketInCustomerScope(
    id: string,
    customerId: string,
  ): Promise<{
    id: string;
    subject: string;
    category: string | null;
    priority: TicketPriority;
    status: TicketStatus;
    customerId: string;
    contactId: string | null;
    departmentId: string | null;
    assignedToUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const ticket = await this.prisma.ticket.findFirst({ where: { id, customerId } });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }
    return ticket;
  }

  private async findTicketInScope(id: string): Promise<{
    id: string;
    subject: string;
    category: string | null;
    priority: TicketPriority;
    status: TicketStatus;
    customerId: string;
    contactId: string | null;
    departmentId: string | null;
    assignedToUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, branchId, ...(await this.resolveDepartmentVisibilityFilter()) },
    });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }
    return ticket;
  }

  /**
   * Story 68 — see docs/architecture/05-auth-and-security.md ("department
   * visibility"). Returns `{}` (no extra filter — today's exact, unchanged
   * behavior) unless every Role the caller holds for the active
   * branch+department session (`TenantContext.roles`, already scoped to
   * exactly one branch+department pair — see `issueAccessToken`'s own doc
   * comment) is `DEPARTMENT`-scoped. Most-permissive-wins across held
   * roles, mirroring how this codebase already unions permissions across
   * roles rather than intersecting them. Fails safe, not open: an empty/
   * ambiguous role-name lookup resolves to `{}` (full branch visibility),
   * never to a filter that would silently hide every ticket.
   */
  private async resolveDepartmentVisibilityFilter(): Promise<Prisma.TicketWhereInput> {
    if (!(await this.isDepartmentScopedCaller())) {
      return {};
    }
    return { OR: [{ departmentId: this.tenantContext.departmentId }, { departmentId: null }] };
  }

  /**
   * Story 69 — the "assignment" half of the same disclosed doc sentence
   * Story 68 closed the "visibility" half of: a `DEPARTMENT`-scoped caller
   * may not move a ticket they can already see into a *different*
   * department (they could otherwise use their own department's read
   * access to relocate a ticket somewhere they'd never be granted
   * visibility into). Deliberately narrow: only `departmentId`
   * reassignment is restricted here — restricting `assignedToUserId` by
   * the target user's own department is a separate, still-open design
   * question (a user can hold multiple department memberships in this
   * branch; which one would even apply is genuinely ambiguous) and stays
   * an explicit non-goal, same discipline as Story 68's own.
   */
  private async requireAllowedDepartmentReassignment(newDepartmentId: string): Promise<void> {
    if (!(await this.isDepartmentScopedCaller())) {
      return;
    }
    if (newDepartmentId !== this.tenantContext.departmentId) {
      throw new BadRequestException(
        "Your role can only assign tickets within your own department",
      );
    }
  }

  /** Shared by `resolveDepartmentVisibilityFilter` and
   * `requireAllowedDepartmentReassignment` — `true` only when every Role
   * the caller holds for the active branch+department session is
   * `DEPARTMENT`-scoped (most-permissive-wins across held roles). Fails
   * safe: an empty/ambiguous role-name lookup resolves to `false`. */
  private async isDepartmentScopedCaller(): Promise<boolean> {
    const roleNames = this.tenantContext.roles;
    if (roleNames.length === 0) {
      return false;
    }
    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
      select: { ticketVisibilityScope: true },
    });
    return roles.length > 0 && roles.every((role) => role.ticketVisibilityScope === "DEPARTMENT");
  }

  private async requireDepartmentInScope(departmentId: string, branchId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, branchId },
    });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
  }

  /** A "user in scope" means they hold at least one role in this branch — see UserBranchRole. */
  private async requireUserInScope(userId: string, branchId: string): Promise<void> {
    const membership = await this.prisma.userBranchRole.findFirst({
      where: { userId, branchId },
    });
    if (!membership) {
      throw new NotFoundException("User not found in this branch");
    }
  }

  /**
   * `TicketNote.authorUserId` is required (Design item 2) — every route that
   * creates one sits behind `AuthGuard`, so `TenantContext.userId` is always
   * populated in practice; this only guards the invariant, mirroring
   * `requireBranchScope`'s own plain-`Error`-on-violation convention.
   */
  private requireAuthenticatedUserId(): string {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no authenticated user on this request");
    }
    return userId;
  }
}

export function toTicketSummary(ticket: {
  id: string;
  subject: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  customerId: string;
  contactId: string | null;
  departmentId: string | null;
  assignedToUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TicketSummary {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    customerId: ticket.customerId,
    contactId: ticket.contactId,
    departmentId: ticket.departmentId,
    assignedToUserId: ticket.assignedToUserId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

function toCsatSummary(response: {
  id: string;
  ticketId: string;
  submittedByContactId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}): TicketCsatSummary {
  return {
    id: response.id,
    ticketId: response.ticketId,
    submittedByContactId: response.submittedByContactId,
    rating: response.rating,
    comment: response.comment,
    createdAt: response.createdAt,
  };
}
