# agent-workspace-roles-permissions-viewer — plan overview

Entry point for the **agent-workspace-roles-permissions-viewer** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 34  | [34-story-agent-workspace-roles-permissions-viewer.md](./34-story-agent-workspace-roles-permissions-viewer.md) | Agent Workspace — Roles & Permissions Viewer | — | `project-foundation` Story 03 |

## Dependency notes

- New feature slug. Entirely new route/component surface (`/roles`) — touches no existing screen.
- Consumes `GET /identity/roles`/`GET /identity/permissions` exactly as already implemented (Story 03) — `UsersController`/`IdentityService` are not modified. No new backend contract. Read-only — no mutation of any kind.
- Does **not** touch realtime, notifications, SLA-policies, `schema.prisma`/migrations, or any worker code.
- **Parallel batch**: developed independently alongside `agent-workspace-business-hours-admin` (Story 33) — zero file overlap (dedicated new files on both sides).
