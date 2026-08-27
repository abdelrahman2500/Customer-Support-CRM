import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateTicketDto } from "./dto/create-ticket.dto";
import type { UpdateTicketDto } from "./dto/update-ticket.dto";
import { TICKET_CREATED_EVENT, TICKET_UPDATED_EVENT, TICKET_RECATEGORIZED_EVENT } from "./tickets.events";
import type { TicketCreatedEvent, TicketUpdatedEvent, TicketRecategorizedEvent } from "./tickets.events";

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
}

export interface TicketHistoryEntrySummary {
  id: string;
  eventType: string;
  actorUserId: string | null;
  snapshot: unknown;
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

  async listTickets(): Promise<TicketSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const tickets = await this.prisma.ticket.findMany({
      where: { branchId },
      orderBy: { createdAt: "asc" },
    });
    return tickets.map(toTicketSummary);
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

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

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
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const ticket = await this.prisma.ticket.findFirst({ where: { id, branchId } });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }
    return ticket;
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
  };
}
