import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, deleteTask, listTasks, updateTask } from "@/lib/tasks-api";
import type { CreateTaskInput, ListTasksParams, UpdateTaskInput } from "@/lib/tasks-api";

/**
 * RM-03 — dedicated tasks hooks, mirroring `use-quick-replies.ts`'s
 * never-optimistic convention exactly. A single shared query key for the
 * whole `tasks` resource (mirroring `quickRepliesQueryKey`) — the Agent
 * Dashboard's task panel is the one caller today, so per-filter cache
 * entries would add complexity with no present benefit; every mutation
 * invalidates it uniformly.
 */
export const tasksQueryKey = ["tasks"] as const;

export function useTasksQuery(params: ListTasksParams = {}) {
  return useQuery({
    queryKey: [...tasksQueryKey, params],
    queryFn: () => listTasks(params),
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });
}

export function useUpdateTaskMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => updateTask(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });
}

export function useDeleteTaskMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteTask(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });
}
