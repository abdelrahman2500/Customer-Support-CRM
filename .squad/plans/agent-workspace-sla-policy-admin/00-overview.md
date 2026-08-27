# agent-workspace-sla-policy-admin — plan overview

Entry point for the **agent-workspace-sla-policy-admin** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 31  | [31-story-agent-workspace-sla-policy-admin.md](./31-story-agent-workspace-sla-policy-admin.md) | Agent Workspace — SLA Policy Management | — | `sla-policy-foundation` Story 10 |

## Dependency notes

- New feature slug. Entirely new route/component surface (`/sla-policies`, `/sla-policies/new`) — touches no existing screen.
- Consumes `POST/GET/GET:id/PATCH:id /sla-policies` exactly as already implemented (Story 10) — `SlaPoliciesController`/`SlaPoliciesService`/DTOs are not modified. No new backend contract.
- Does **not** touch realtime, notifications, SLA target computation/timer/escalation logic, `schema.prisma`/migrations, or any worker code.
- **Parallel batch**: developed independently alongside `agent-workspace-customer-editing` (Story 30) and `agent-workspace-user-admin` (Story 32). This story introduces its own dedicated `apps/web/src/lib/sla-policies-api.ts` and `apps/web/src/hooks/use-sla-policies.ts` files — **zero file overlap** with either of the other two stories.
- NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` — unchanged by this story.
