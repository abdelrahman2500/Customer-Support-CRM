import { apiFetch } from "./api";
import type { PaginatedResponse } from "./paginated";

/**
 * RM-03 — Agent Tasks & Reminders. Mirrors the backend's own
 * `TaskSummary` (`apps/api/src/modules/tasks/tasks.service.ts`) exactly.
 */
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskSummary {
  id: string;
  title: string;
  notes: string | null;
  priority: TaskPriority;
  ticketId: string | null;
  customerId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  priority?: TaskPriority;
  ticketId?: string;
  customerId?: string;
  dueAt?: string;
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string | null;
  priority?: TaskPriority;
  ticketId?: string | null;
  customerId?: string | null;
  dueAt?: string | null;
  completed?: boolean;
}

export interface ListTasksParams {
  completed?: "true" | "false";
  ticketId?: string;
  page?: number;
  pageSize?: number;
}

export function listTasks(params: ListTasksParams = {}): Promise<PaginatedResponse<TaskSummary>> {
  const query = new URLSearchParams();
  if (params.completed !== undefined) query.set("completed", params.completed);
  if (params.ticketId !== undefined) query.set("ticketId", params.ticketId);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return apiFetch<PaginatedResponse<TaskSummary>>(`/tasks${qs ? `?${qs}` : ""}`);
}

export function createTask(input: CreateTaskInput): Promise<TaskSummary> {
  return apiFetch<TaskSummary>("/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function updateTask(id: string, input: UpdateTaskInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteTask(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/tasks/${id}`, { method: "DELETE" });
}
