# agent-workspace-navigation-menu — plan overview

Entry point for the **agent-workspace-navigation-menu** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 44  | [44-story-agent-workspace-navigation-menu.md](./44-story-agent-workspace-navigation-menu.md) | Agent Workspace — Persistent Navigation Menu | — | Every existing top-level Agent Workspace screen (Stories 23, 26, 28, 31, 32, 33, 34, 38, 39, 40) |

## Dependency notes

- **Explicit product decision, recorded here**: every prior Agent Workspace story since Story 23 deferred a persistent navigation menu as out of scope. That deferral is now explicitly reversed by product decision (this session, prior to this plan) — this story is not reopening a settled decision, it is executing one that was just settled.
- Pure frontend, zero backend: no new endpoint, DTO, permission, or Prisma model. Confirmed via fresh inspection this planning pass (`apps/api` last touched at commit `10c3e02`, long before this story).
- Extends exactly one existing component (`WorkspaceNav`) — not a new screen, not a new route.
- **No file overlap** with any other in-flight or recently-merged story: `workspace-nav.tsx`/`workspace-nav.spec.tsx` were last touched by Story 41 (session refresh, already merged) and have zero relationship to `tickets-api.ts` (Stories 42/43's shared file) or any other currently-relevant file.
- Does **not** decide or start the next major product phase (Customer Portal/Channels, Admin self-service, Automatic assignment, Agent Dashboard depth, Reports, Knowledge Base/AI) — per explicit product instruction, that decision follows a fresh recon **after** this story, not as part of it.
- Does **not** include a README cleanup — per explicit product instruction, the README's pre-existing drift (stale "through Story 32" state, the now-false "Known gap: Story 31" note) is left for whichever future story naturally touches that content, not folded into this one.
