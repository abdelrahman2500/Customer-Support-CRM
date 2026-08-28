# agent-workspace-branch-department-admin — plan overview

Entry point for the **agent-workspace-branch-department-admin** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 45  | [45-story-agent-workspace-branch-department-admin.md](./45-story-agent-workspace-branch-department-admin.md) | Agent Workspace: Branch & Department Management, Admin Self-Service | — | `project-foundation` Story 02/03 (`Branch`/`Department` Prisma models), `identity-branch-department-listing` Story 35 (`GET /identity/branches`, `GET /identity/departments`, `branch:read`), `agent-workspace-user-admin` Story 38 (`useDepartmentsQuery`/department picker, left untouched), `agent-workspace-navigation-menu` Story 44 (`WorkspaceNav`, extended with one new link) |

## Dependency notes

- **Recorded after the fact.** This plan documents a FINAL PLAN that was produced by a prior multi-agent planning pass conducted as an ad-hoc conversation (not a run of the `squad` CLI tool), approved, and then fully implemented — backend Prisma schema/migration/seed/DTOs/service/controller, frontend API client/hooks/UI/nav/i18n, and full unit/e2e/component test coverage — before this artifact was written. As of this writing the implementation is complete but **not yet committed to git**. This file, its sibling story file, and the paired intake file exist to preserve this repository's established one-plan-file-per-feature / one-story-file-per-story / one-intake-file-per-story convention, matching every other planned story (see `00-index.md`'s two explicitly-annotated `(unplanned)` exceptions — Story 24 and Stories 38–40 — which are the only stories in this repository's history implemented directly from a raw specification with no planning pass and, correspondingly, no plan/story representation; this story is not one of those, since a real planning pass with resolved design decisions did occur).
- Extends the existing `IdentityModule` (`identity.service.ts`, `users.controller.ts`, `dto/`) — no new module, no new controller file.
- Adds two Prisma columns (`Branch.isActive`, `Department.isActive`) and one new constraint (`@@unique([organizationId, name])` on `Branch`; `Department` already had `@@unique([branchId, name])` since Story 02/03) via one migration. No new model.
- Adds three permission keys to the existing seed catalog: `branch:update`, `department:create`, `department:update` — deliberately no `branch:create` (branch creation stays out of scope; see the Story 03 plan and this story's Non-Goals).
- Adds an `includeInactive` query parameter to the two existing Story 35 `GET` endpoints — purely additive, default-`false` behavior unchanged for every existing caller (`useDepartmentsQuery`/`useBranchesQuery`-style pickers in `tickets-api.ts`, consumed by `CreateUserView`/`CreateTicketView`/`TicketDetailView`, are untouched and continue to see only active rows).
- New, separate frontend API/hook files (`branches-api.ts`, `use-branches.ts`) rather than extending `tickets-api.ts`/`use-tickets.ts` — deliberately not sharing query keys or types with the existing active-only branch/department *pickers*, since this story's management view must be able to see and reactivate inactive rows. `tickets-api.ts` and `use-tickets.ts` are untouched.
- One new top-level screen (`/branches`) and one new persistent nav link, added to the `WorkspaceNav` component Story 44 introduced — no change to `(agent)/layout.tsx` or any other screen.
