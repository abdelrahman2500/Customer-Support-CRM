# agent-workspace-customer-editing — plan overview

Entry point for the **agent-workspace-customer-editing** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 30  | [30-story-agent-workspace-customer-editing.md](./30-story-agent-workspace-customer-editing.md) | Agent Workspace — Customer & Contact Editing | — | `customer-management` Story 06, `agent-workspace-customer-management` Story 26 |

## Dependency notes

- New feature slug. Extends `CustomerDetailView` (Story 26/27) with edit capability — does not replace it.
- Consumes `PATCH /customers/:id`, `POST/PATCH /customers/:id/contacts` exactly as already implemented (Story 06/25) — `CustomersController`/`ContactsController`/`CustomersService`/DTOs are not modified. No new backend contract.
- Does **not** touch realtime, notifications, SLA-policies, `schema.prisma`/migrations, or any worker code.
- **Parallel batch**: developed independently alongside `agent-workspace-sla-policy-admin` (Story 31) and `agent-workspace-user-admin` (Story 32) — see each plan's "Parallel-batch overlap note" for the one disclosed shared-file overlap (with Story 32 only, via `tickets-api.ts`/`use-tickets.ts`).
- NN 24 remains intentionally absent/annotated in `.squad/plans/00-index.md` — unchanged by this story.
