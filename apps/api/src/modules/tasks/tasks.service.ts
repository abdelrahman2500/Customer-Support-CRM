import { Injectable, NotFoundException } from "@nestjs/common";
import type { TaskPriority } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { paginate } from "../../common/pagination/paginate";
import type { Paginated } from "../../common/pagination/paginated";
import { TicketsService } from "../tickets/tickets.service";
import { CustomersService } from "../customers/customers.service";
import type { CreateTaskDto } from "./dto/create-task.dto";
import type { UpdateTaskDto } from "./dto/update-task.dto";
import type { ListTasksQueryDto } from "./dto/list-tasks-query.dto";

export interface TaskSummary {
  id: string;
  title: string;
  notes: string | null;
  priority: TaskPriority;
  ticketId: string | null;
  customerId: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RM-03 — Agent Tasks & Reminders. A personal resource: every method here
 * is scoped to the caller's own `ownerUserId` (resolved exclusively from
 * `TenantContext`, never accepted from a request body/param), mirroring
 * `NotificationsService.markRead`'s exact "an id is never accepted from
 * the caller" convention. There is no cross-agent visibility at all —
 * unlike `Ticket`, a task is never department/branch-wide, so no
 * `@RequirePermissions` gate exists either (mirrors
 * `NotificationPreferencesController`'s own "personal config, no
 * dedicated permission" precedent).
 *
 * `ticketId`/`customerId` are validated in-scope by reusing
 * `TicketsService.getTicket`/`CustomersService.getCustomer` — both already
 * throw `NotFoundException` for a row outside the caller's own branch/
 * department scope, so a task can never reference a ticket or customer
 * the caller could not otherwise read. Neither association is re-resolved
 * or re-authorized anywhere else.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly ticketsService: TicketsService,
    private readonly customersService: CustomersService,
  ) {}

  async createTask(dto: CreateTaskDto): Promise<TaskSummary> {
    const ownerUserId = this.requireOwnerUserId();

    if (dto.ticketId) {
      await this.ticketsService.getTicket(dto.ticketId);
    }
    if (dto.customerId) {
      await this.customersService.getCustomer(dto.customerId);
    }

    const task = await this.prisma.task.create({
      data: {
        ownerUserId,
        title: dto.title,
        notes: dto.notes ?? null,
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ticketId: dto.ticketId ?? null,
        customerId: dto.customerId ?? null,
        dueAt: dto.dueAt !== undefined ? new Date(dto.dueAt) : null,
      },
    });
    return toSummary(task);
  }

  /**
   * Always filtered to the caller's own tasks — `ownerUserId` never
   * appears as a query parameter this or any caller could override (see
   * `ListTasksQueryDto`, which exposes no such field at all).
   *
   * Ordering: soonest-due first, then oldest-created first, `id` as the
   * final tiebreaker. A task with no `dueAt` sorts last under plain
   * ascending order without any extra syntax — Postgres's own default
   * `NULLS LAST` behavior for `ASC` is exactly the ordering a task list
   * wants (undated tasks are lower urgency, not "most urgent").
   */
  async listTasks(query: ListTasksQueryDto = {}): Promise<Paginated<TaskSummary>> {
    const ownerUserId = this.requireOwnerUserId();

    const where = {
      ownerUserId,
      ...(query.completed === "true" ? { completedAt: { not: null } } : {}),
      ...(query.completed === "false" ? { completedAt: null } : {}),
      ...(query.ticketId ? { ticketId: query.ticketId } : {}),
    };

    const { items: tasks, ...pagination } = await paginate(this.prisma.task, {
      where,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      page: query.page,
      pageSize: query.pageSize,
    });

    return { ...pagination, items: tasks.map(toSummary) };
  }

  /**
   * Changing `ticketId`/`customerId` re-validates in-scope exactly like
   * `createTask`; explicit `null` clears the association without any
   * validation call (there is nothing to check a non-reference against).
   *
   * Changing `dueAt` (to any value, including clearing it) resets
   * `reminderSentAt` back to `null` — otherwise a task whose reminder
   * already fired, then had its due date pushed out, would never remind
   * again for the new date; `TaskReminderProcessor`'s claim only ever
   * looks at `reminderSentAt`, never compares it against which `dueAt` it
   * was set for.
   *
   * `completed` toggles `completedAt` to `now()`/`null` — the server
   * always decides the timestamp, never the caller.
   */
  async updateTask(id: string, dto: UpdateTaskDto): Promise<{ id: string }> {
    await this.findTaskInScope(id);

    if (dto.ticketId) {
      await this.ticketsService.getTicket(dto.ticketId);
    }
    if (dto.customerId) {
      await this.customersService.getCustomer(dto.customerId);
    }

    await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.ticketId !== undefined ? { ticketId: dto.ticketId } : {}),
        ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
        ...(dto.dueAt !== undefined
          ? { dueAt: dto.dueAt === null ? null : new Date(dto.dueAt), reminderSentAt: null }
          : {}),
        ...(dto.completed !== undefined
          ? { completedAt: dto.completed ? new Date() : null }
          : {}),
      },
    });
    return { id };
  }

  async deleteTask(id: string): Promise<{ id: string }> {
    await this.findTaskInScope(id);
    await this.prisma.task.delete({ where: { id } });
    return { id };
  }

  private requireOwnerUserId(): string {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no active user on this request");
    }
    return userId;
  }

  /** Masks "belongs to another agent" and "doesn't exist" identically as
   * a 404, mirroring `TicketsService.findTicketInScope`'s own documented
   * convention. */
  private async findTaskInScope(id: string): Promise<{ id: string }> {
    const ownerUserId = this.requireOwnerUserId();
    const task = await this.prisma.task.findFirst({ where: { id, ownerUserId }, select: { id: true } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    return task;
  }
}

function toSummary(task: {
  id: string;
  title: string;
  notes: string | null;
  priority: TaskPriority;
  ticketId: string | null;
  customerId: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TaskSummary {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    ticketId: task.ticketId,
    customerId: task.customerId,
    dueAt: task.dueAt,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
