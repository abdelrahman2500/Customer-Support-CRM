# agent-workspace-user-admin — plan overview

Entry point for the **agent-workspace-user-admin** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 32  | [32-story-agent-workspace-user-admin.md](./32-story-agent-workspace-user-admin.md) | Agent Workspace — User Management (list, deactivate, rename) | — | `project-foundation` Story 03 |

## Dependency notes

- New feature slug. Entirely new route/component surface (`/users`) — touches no existing screen.
- Consumes `GET/PATCH /identity/users` exactly as already implemented (Story 03) — `UsersController`/`IdentityService`/DTOs are not modified. No new backend contract. User **creation** is explicitly out of scope (blocked on a missing branch/department-listing endpoint, not attempted here).
- Does **not** touch realtime, notifications, SLA-policies, `schema.prisma`/migrations, or any worker code.
- **Parallel batch**: developed independently alongside `agent-workspace-customer-editing` (Story 30) and `agent-workspace-sla-policy-admin` (Story 31) — see this plan's "Parallel-batch overlap note" for the one disclosed shared-file overlap (with Story 30 only, via `tickets-api.ts`/`use-tickets.ts`).
- NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` — unchanged by this story.
