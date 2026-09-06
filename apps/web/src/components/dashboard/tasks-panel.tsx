"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useTasksQuery,
  useUpdateTaskMutation,
} from "@/hooks/use-tasks";
import { useTaskReminders } from "@/hooks/use-task-reminders";
import type { TaskPriority, TaskSummary } from "@/lib/tasks-api";
import { ticketPriorityBadgeVariant } from "@/lib/ticket-badges";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/**
 * RM-03 — Agent Tasks & Reminders. Mirrors `DashboardView`'s existing
 * panel shape (`rounded-md border ... p-4`, loading skeletons, error
 * alert with retry, empty state, list) and `QuickRepliesView`'s exact
 * "inline add-form below the list" convention — a new, self-contained
 * component rather than growing `dashboard-view.tsx` further, mounted
 * there alongside the existing ticket panels.
 *
 * Only open tasks are listed (`completed: "false"`) — a completed task
 * has nothing left to act on here; there is no separate "completed
 * tasks" archive view in this first slice (mirrors the roadmap's own
 * "personal tasks... completion... useful dashboard visibility" scope,
 * not a full task-management screen).
 *
 * `useTaskReminders` invalidates this panel's own query cache when a
 * due-task realtime event arrives for the signed-in agent (mirrors
 * `useTicketRealtime`'s own "own the query client, invalidate directly"
 * architecture) — not a separate toast/notification mechanism (this
 * codebase's branch-wide toast store is deliberately narrow to three
 * unrelated event types — see `notifications-store.ts`'s own doc comment
 * — and a personal task reminder is a different kind of thing to
 * surface).
 */
export function TasksPanel({ userId }: { userId: string }) {
  const t = useTranslations("dashboard");
  const tasksQuery = useTasksQuery({ completed: "false" });

  useTaskReminders(userId);

  const tasks = tasksQuery.data?.items ?? [];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("tasks.heading")}</h2>

      {tasksQuery.isLoading && (
        <div className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {tasksQuery.isError && (
        <Alert variant="destructive" className="mt-2 flex items-center justify-between">
          <span>{t("tasks.error")}</span>
          <Button variant="outline" size="sm" onClick={() => tasksQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {tasksQuery.isSuccess && tasks.length === 0 && (
        <p className="mt-2 rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
          {t("tasks.empty")}
        </p>
      )}

      {tasksQuery.isSuccess && tasks.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}

      <AddTaskForm />
    </div>
  );
}

function isOverdue(task: TaskSummary, now: Date): boolean {
  return task.dueAt !== null && new Date(task.dueAt) < now;
}

/** A dedicated component per row — `useUpdateTaskMutation(id)`/
 * `useDeleteTaskMutation(id)` are hooks and must be called once per
 * component instance, not once per loop iteration, mirroring
 * `UnclaimedTicketRow`'s own Rules-of-Hooks convention. */
function TaskRow({ task }: { task: TaskSummary }) {
  const t = useTranslations("dashboard");
  const errorMessage = useErrorMessage();
  const completeMutation = useUpdateTaskMutation(task.id);
  const deleteMutation = useDeleteTaskMutation(task.id);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const now = new Date();

  return (
    <li className="flex flex-col gap-1 border-b border-slate-100 pb-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex flex-col">
        <span className="font-medium text-slate-800">{task.title}</span>
        {task.dueAt && (
          <span className={isOverdue(task, now) ? "text-xs text-red-600" : "text-xs text-ink-subtle"}>
            {new Date(task.dueAt).toLocaleString()}
          </span>
        )}
        {completeMutation.isError && (
          <span className="text-xs text-red-600">
            {errorMessage(completeMutation.error, {
              forbidden: t("tasks.actionForbidden"),
              generic: t("tasks.actionFailed"),
            })}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <Badge variant={ticketPriorityBadgeVariant(task.priority)}>{task.priority}</Badge>
        {isOverdue(task, now) && <Badge variant="destructive">{t("tasks.overdue")}</Badge>}
        <Button
          size="sm"
          variant="outline"
          disabled={completeMutation.isPending}
          onClick={() => completeMutation.mutate({ completed: true })}
        >
          {t("tasks.completeButton")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={deleteMutation.isPending}
          onClick={() => setConfirmDeleteOpen(true)}
        >
          {t("tasks.deleteButton")}
        </Button>
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title={t("tasks.deleteConfirmTitle")}
          description={t("tasks.deleteConfirmDescription", { title: task.title })}
          confirmLabel={t("tasks.deleteButton")}
          onConfirm={() => deleteMutation.mutate(undefined, { onSuccess: () => setConfirmDeleteOpen(false) })}
          isPending={deleteMutation.isPending}
        />
      </span>
    </li>
  );
}

/** The smallest UI surface for a create form — mirrors
 * `AddQuickReplyForm`'s exact submit/error pattern. `dueAt` is a plain
 * native `datetime-local` input — no dedicated date/time primitive exists
 * in `@crm/ui`, matching this codebase's own "a plain HTML control is the
 * simplest existing precedent" convention (see `AddQuickReplyForm`'s own
 * plain `<textarea>`). */
function AddTaskForm() {
  const t = useTranslations("dashboard");
  const errorMessage = useErrorMessage();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateTaskMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        title: title.trim(),
        priority,
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      });
      setTitle("");
      setDueAt("");
      setPriority("MEDIUM");
    } catch (submitError) {
      setError(
        errorMessage(submitError, {
          forbidden: t("tasks.actionForbidden"),
          generic: t("tasks.createFailed"),
        }),
      );
    }
  }

  return (
    <form className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={handleSubmit}>
      <label className="flex flex-1 flex-col gap-1 text-xs text-slate-600">
        {t("tasks.titleLabel")}
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={1}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("tasks.dueLabel")}
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="flex h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-ring"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("tasks.priorityLabel")}
        <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
          <SelectTrigger className="w-32" aria-label={t("tasks.priorityLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <div>
        <Button type="submit" size="sm" disabled={mutation.isPending || !title.trim()}>
          {mutation.isPending ? t("tasks.createSubmitting") : t("tasks.createSubmit")}
        </Button>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
    </form>
  );
}
