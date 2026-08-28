# agent-workspace-session-refresh — plan overview

Entry point for the **agent-workspace-session-refresh** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 41  | [41-story-agent-workspace-session-refresh.md](./41-story-agent-workspace-session-refresh.md) | Agent Workspace — Session Refresh & Real Sign-Out | — | `project-foundation` Story 02 (login/JWT foundation), `agent-workspace-ticket-operations-mvp` Story 23 (`CORS_ORIGINS`/`credentials: true` wiring, added specifically anticipating the refresh-token cookie) |

## Dependency notes

- New feature slug, but **not** a new route/screen — this story extends two existing shared files (`apps/web/src/lib/api.ts`, `apps/web/src/components/workspace/workspace-nav.tsx`) plus a one-line, behavior-preserving touch to `apps/web/src/app/[locale]/(auth)/login/page.tsx`. Unlike every prior Agent Workspace story (30–40), this one cannot be built as an entirely new, zero-overlap file — the whole point is to fix the one shared request pipeline every screen already goes through.
- Consumes `POST /auth/refresh`/`POST /auth/logout` exactly as already implemented (Story 02) — `IdentityController`/`IdentityService` are not modified. No new backend endpoint, DTO, or contract change.
- Does **not** touch realtime, notifications, SLA logic, `schema.prisma`/migrations, or any worker code.
- **Not safe to parallelize with a story that also touches `workspace-nav.tsx`** (a hypothetical persistent-nav-menu story) — this story already claims that file. Safe to parallelize with ticket-detail/ticket-creation-extension stories (`tickets-api.ts`, `ticket-detail-view.tsx`, `create-ticket-view.tsx` — zero overlap with this story's files).
- Stories 38/39/40 (Create User, Notification History, Audit Log Viewer) are prerequisites only in the sense that they are already-merged, already-verified precedent for "frontend-only consumption of an already-complete backend contract" — no functional dependency on their code.
