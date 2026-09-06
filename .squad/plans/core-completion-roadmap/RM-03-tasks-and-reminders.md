# RM-03 — Agent Tasks &amp; Reminders

**Priority:** P0 · **Complexity:** Medium · **Blocked:** No · **Phase:** 1 (Agent Experience)

## Goal

Let an agent create a personal task or a time-based reminder — optionally
tied to a ticket — and see it surface on their own Agent Dashboard.

## Why it exists

Core 4 (Agent Dashboard) names "Tasks and reminders" explicitly. No `Task`
or `Reminder` model, API, or UI exists anywhere — confirmed by a full read
of `schema.prisma` (1400+ lines) and of `apps/web/src`/`apps/api/src`.
Agents today have no first-party way to track a personal follow-up beyond
re-reading a ticket later or relying on memory.

## Dependencies

None new. Reuses the existing `NotificationLog`/`BranchNotificationRealtimeListener`
pattern for the due-reminder alert, and the existing `ai-processing`/
`sla-timers` BullMQ queue module for the due-time check (a new lightweight
recurring job, same `queues.module.ts` registration pattern).

## Backend work

- New `Task` model: `id`, `branchId`, `ownerUserId`, `title`, `dueAt`
  (nullable — a task with no due date is just a checklist item), `ticketId`
  (nullable FK), `completedAt` (nullable), `createdAt`.
- `POST /tasks`, `GET /tasks` (own tasks, paginated, filterable by
  `completed`/`ticketId`), `PATCH /tasks/:id` (edit title/dueAt, mark
  complete), gated by a new `task:*` permission set (personal-resource
  pattern, mirrors `NotificationPreference`'s "no dedicated permission
  needed beyond authentication" precedent if a task is *always* own-only —
  confirm during implementation whether a manager-visibility case is
  actually needed; default to owner-only, no cross-agent visibility, since
  nothing in the Recon disclosed a "manager assigns tasks to agents" need).
- A recurring worker job (mirrors `SlaTimerProcessor`'s `upsertJobScheduler`
  pattern) that finds tasks with `dueAt <= now()` and `completedAt: null`,
  not yet notified, and fires a `NotificationLog` + realtime event — reusing
  the exact `BranchNotificationRealtimeListener` relay shape, scoped to the
  task's own `ownerUserId` (a new `agent:{id}:notifications`-shaped room, or
  reuse the existing per-agent presence room's pattern for a personal
  channel — decide the minimal correct room shape during implementation).

## Frontend work

- A "My Tasks" panel on `DashboardView`, alongside the existing "my open
  tickets"/"unclaimed tickets" panels — create/complete/dismiss inline.
- A lightweight "add task" affordance from `TicketDetailView` (pre-fills
  `ticketId`), so a task can originate from the screen an agent is already
  in.

## Worker/realtime work

- New recurring BullMQ job (see Backend work) + one new realtime event for
  a due reminder firing.

## Schema/migration work

One new table (`Task`), one migration, FKs to `User` (owner) and `Ticket`
(nullable).

## Tests

- `tasks.service.spec.ts` (new), `tasks.e2e-spec.ts` (new) — CRUD, ownership
  isolation (an agent cannot see another agent's tasks), due-reminder firing.
- `apps/worker` — new processor spec for the due-task check job.
- `apps/web` — `dashboard-view.spec.tsx` extended for the new panel.

## Acceptance criteria

- An agent can create/complete/dismiss a task from the dashboard or from a
  ticket.
- A due reminder produces a `NotificationLog` row and a realtime alert at
  the correct time, visible only to its owning agent.
- Tasks are branch-scoped like every other domain model.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/worker test`,
  `pnpm --filter @crm/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
  pass.
- One dedicated commit, pushed.
