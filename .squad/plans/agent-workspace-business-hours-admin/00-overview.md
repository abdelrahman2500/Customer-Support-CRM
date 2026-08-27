# agent-workspace-business-hours-admin — plan overview

Entry point for the **agent-workspace-business-hours-admin** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 33  | [33-story-agent-workspace-business-hours-admin.md](./33-story-agent-workspace-business-hours-admin.md) | Agent Workspace — Business Hours Calendar Management | — | `sla-policy-foundation` Story 12 |

## Dependency notes

- New feature slug. Entirely new route/component surface (`/business-hours`) — touches no existing screen.
- Consumes `POST/GET/PATCH /business-hours-calendars` + `POST/GET/PATCH /business-hours-calendars/exceptions*` exactly as already implemented (Story 12) — `BusinessHoursCalendarsController`/`BusinessHoursCalendarsService`/DTOs are not modified. No new backend contract.
- Does **not** touch SLA target computation, realtime, notifications, `schema.prisma`/migrations, or any worker code.
- **Parallel batch**: developed independently alongside `agent-workspace-roles-permissions-viewer` (Story 34) — zero file overlap (dedicated new files on both sides).
