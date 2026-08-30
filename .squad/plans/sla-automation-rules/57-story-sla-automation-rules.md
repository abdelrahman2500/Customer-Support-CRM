# Story 57 — SLA & Automation — Automation Rules Foundation

## Prerequisites

- `ticketing` Story 07/08: `TICKET_CREATED_EVENT`, `TicketsService.createTicket`.
- `sla-policy-foundation`: the `sla`-schema-owning `SlaPoliciesModule` this story's new controller/service/listener are added to (mirrors how `SlaTargets*`/`SlaEscalations*`/`BusinessHoursCalendars*` were each added to the same module rather than a new one).
- `sla-breach-escalation`/`ticket-history-timeline-completion`: `TicketEscalationListener` — the exact cross-domain "listener lives in the domain that owns the mutated data, writes directly to its own Prisma table" pattern this story's new `AutomationActionListener` mirrors.

---

## Story Goal

Let a branch admin define simple automation rules — "when a ticket is created with category X (or any category), auto-assign it to agent Y" — evaluated automatically against every new ticket. Closes `docs/architecture/07-sla-automation-and-ai.md`'s "SLA & automation" section's still-unimplemented `AutomationRule` concept ("a simple trigger-condition-action row, evaluated against domain events").

**Not in scope**: multiple trigger types (only `ticket.created` is supported — no `ticket.updated`/`ticket.recategorized`/SLA-event triggers yet); actions that set `category`/`priority`/`departmentId` (see Design decision 1 — these are `SlaPolicy`'s own matching dimensions and risk desyncing a ticket's SLA target with no reconciliation mechanism); rule priority/ordering UI (first-match-wins by `createdAt`, undocumented to the user beyond "oldest rule wins ties"); a full condition DSL (one optional `category` equality condition only); AI-assisted rule suggestions; a full workflow engine.

---

## Context — Read These Files First

1. `docs/architecture/07-sla-automation-and-ai.md` — "SLA & automation": the `AutomationRule` concept this story implements a first slice of.
2. `apps/api/src/modules/sla-policies/sla-target.listener.ts` — the exact "react to `TICKET_CREATED_EVENT`, re-fetch the ticket by id, catch-and-log" pattern this story's new `AutomationEvaluationListener` mirrors; `resolveBestPolicy`'s `AND`-of-`OR` filter shape for the (much simpler) category-condition match.
3. `apps/api/src/modules/tickets/ticket-escalation.listener.ts` — the exact "listener lives in the domain that owns the data being mutated, writes to its own Prisma table directly, no synchronous cross-module service call" pattern this story's new `AutomationActionListener` mirrors, living in `TicketsModule` instead of `SlaPoliciesModule`.
4. `apps/api/src/modules/tickets/tickets.events.ts` — `TICKET_RECATEGORIZED_EVENT`'s own doc comment, confirming `category`/`priority`/`departmentId` are "the SLA-policy matching fields" (the basis for Design decision 1) and that `assignedToUserId` is not among them.
5. `apps/api/src/modules/sla-policies/{sla-policies.controller,sla-policies.service,sla-policies.module}.ts` — the exact branch-scoped CRUD shape (`create`/`list`/`getOne`/`update`, `findXInScope` 404-masking, `TenantContext.requireBranchScope()`) this story's new `AutomationRulesController`/`AutomationRulesService` mirror field-for-field.
6. `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG` — where `automation:create`/`automation:read`/`automation:update` are added, mirroring `sla:*`'s own naming/grant convention exactly.
7. `apps/web/src/app/[locale]/(agent)/sla-policies/page.tsx` + `apps/web/src/components/sla-policies/*` — the exact list/create-form page shape this story's new Automation Rules screen mirrors.

---

## Design decisions

1. **Only one action type: auto-assign to a specific agent (`actionAssignToUserId`)** — deliberately excludes `category`/`priority`/`departmentId` (see plan overview's dependency note): those three are `SlaPolicy`'s own matching dimensions, and neither `SlaTargetListener` nor anything else reacts to an automation-driven field change the way it reacts to `ticket.recategorized` from a real agent action — building that reconciliation is real, separate scope, deferred.
2. **Only one trigger: `ticket.created`** — not persisted as a field (no fake single-value enum); every `AutomationRule` is implicitly a "on ticket created" rule. A future story adding a second trigger type adds the field then, not speculatively now.
3. **Condition is a single, optional `conditionCategory` equality match** — `null` matches every category (mirrors `SlaPolicy.category`'s own "null = wildcard" convention exactly, including the same `{ OR: [{ conditionCategory: null }, { conditionCategory: ticket.category }] }` filter shape `SlaTargetListener.resolveBestPolicy` already uses for its own category dimension).
4. **First-match-wins, ordered by `createdAt` ascending** — mirrors `SlaTargetListener`'s own tie-break rule (earliest-created candidate wins among equally-specific ones); simpler than specificity-scoring since there is only one condition dimension here, unlike `SlaPolicy`'s three.
5. **Automation never overrides an explicit assignment** — only applies when the newly-created ticket's `assignedToUserId` is still `null` at evaluation time (a caller can already set `assignedToUserId` directly on `POST /tickets`, Story 43 — automation must not clobber a human's explicit choice).
6. **Cross-domain write via a second event, not a direct cross-module Prisma write or service call** — `AutomationEvaluationListener` (lives in `SlaPoliciesModule`, owns `AutomationRule`) reacts to `TICKET_CREATED_EVENT`, and on a match emits a new `AUTOMATION_RULE_MATCHED_EVENT` (own file, `sla-policies/automation.events.ts`, same shape convention as `sla-detection.events.ts`). A new `AutomationActionListener` (lives in `TicketsModule`, owns `Ticket`) reacts to that event and performs the actual `prisma.ticket.update(...)` directly on its own table — mirrors `TicketEscalationListener`'s exact "reacting domain lives where the data lives" pattern (docs/architecture/03-domain-boundaries.md Rule 1: never import another module's Prisma model directly).
7. **`AutomationActionListener` emits `TICKET_UPDATED_EVENT` after its write** (`actorUserId: null`, mirrors `TicketEscalatedEvent`'s "no human actor" precedent) — `TicketHistoryListener` already subscribes to `TICKET_UPDATED_EVENT`, so the automated assignment appears in the ticket's history/timeline for free, no new listener needed there.
8. **New permission resource `automation:*`** (`create`/`read`/`update`), added to `PERMISSION_CATALOG`, granted to `SuperAdmin` only via the existing wildcard (mirrors `sla:*`'s own initial-grant precedent; `Agent` gets none by default).
9. **`actionAssignToUserId` validated at rule-create/update time** — must be a real user with a branch-role membership in the caller's branch (mirrors `TicketsService.requireUserInScope`'s exact `userBranchRole.findFirst({ userId, branchId })` check; a second, independent copy in the new service, matching this codebase's existing per-module-copy convention — no shared cross-module validation helper exists anywhere else either).

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — add:
   ```prisma
   /// A simple trigger-condition-action automation rule
   /// (docs/architecture/07-sla-automation-and-ai.md — "AutomationRule").
   /// v1: trigger is implicitly `ticket.created` (not persisted — see the
   /// plan's Design decision 2); condition is a single optional category
   /// equality match; action is always "assign to a specific agent" (Design
   /// decision 1 explains why category/priority/department are excluded).
   model AutomationRule {
     id                   String   @id @default(uuid())
     branchId             String   @map("branch_id")
     name                 String
     isActive             Boolean  @default(true) @map("is_active")
     conditionCategory    String?  @map("condition_category")
     actionAssignToUserId String   @map("action_assign_to_user_id")
     createdAt            DateTime @default(now()) @map("created_at")
     updatedAt            DateTime @updatedAt @map("updated_at")

     @@index([branchId])
     @@map("automation_rules")
     @@schema("sla")
   }
   ```
2. **Migration** — generated via `prisma migrate dev` against the real local Postgres.
3. **`apps/api/prisma/seed.ts`** — add `"automation:create"`, `"automation:read"`, `"automation:update"` to `PERMISSION_CATALOG`.
4. **New `apps/api/src/modules/sla-policies/dto/{create-automation-rule.dto,update-automation-rule.dto}.ts`** — mirror `{create,update}-sla-policy.dto.ts` field-for-field (`name: string`, `conditionCategory?: string`, `actionAssignToUserId: string` on create; all optional plus `isActive?: boolean` on update).
5. **New `apps/api/src/modules/sla-policies/automation-rules.service.ts`** — `AutomationRuleSummary` interface; `createAutomationRule`/`listAutomationRules`/`getAutomationRule`/`updateAutomationRule`, mirroring `SlaPoliciesService` field-for-field (`findAutomationRuleInScope`, `requireUserInScope`).
6. **New `apps/api/src/modules/sla-policies/automation-rules.controller.ts`** — `@Controller("automation-rules")`, `POST`/`GET`/`GET :id`/`PATCH :id`, gated by `automation:create`/`automation:read`/`automation:read`/`automation:update` respectively.
7. **New `apps/api/src/modules/sla-policies/automation.events.ts`** — `AUTOMATION_RULE_MATCHED_EVENT = "automation.rule_matched"`, `AutomationRuleMatchedEvent { ticketId: string; ruleId: string; assignToUserId: string }`.
8. **New `apps/api/src/modules/sla-policies/automation-evaluation.listener.ts`** — `@OnEvent(TICKET_CREATED_EVENT)`: re-fetch the ticket by `event.ticket.id` (`branchId`, `category`, `assignedToUserId`); skip if `assignedToUserId` is already set (Design decision 5); query active `AutomationRule`s for that branch with the category-OR-null filter, ordered `createdAt asc`, take the first match; if found, emit `AUTOMATION_RULE_MATCHED_EVENT`. Catch-and-log throughout (mirrors `SlaTargetListener`).
9. **New `apps/api/src/modules/tickets/automation-action.listener.ts`** — `@OnEvent(AUTOMATION_RULE_MATCHED_EVENT)`: re-fetch the ticket by `event.ticketId`; if still unassigned, `prisma.ticket.update({ where: { id }, data: { assignedToUserId: event.assignToUserId } })`, then emit `TICKET_UPDATED_EVENT` (`actorUserId: null`). Catch-and-log (mirrors `TicketEscalationListener`).
10. **`apps/api/src/modules/sla-policies/sla-policies.module.ts`** — add the new controller/service/listener to the existing module's arrays (mirrors how `BusinessHoursCalendars*` was added in a prior story).
11. **`apps/api/src/modules/tickets/tickets.module.ts`** — add `AutomationActionListener` to providers.
12. **Tests** — see Test Plan.

### Frontend

13. **New `apps/web/src/lib/automation-rules-api.ts`** — own file (mirrors `sla-policies-api.ts`): `AutomationRuleSummary` type + `listAutomationRules`/`createAutomationRule`/`updateAutomationRule`.
14. **New `apps/web/src/hooks/use-automation-rules.ts`** — `useAutomationRulesQuery`/`useCreateAutomationRuleMutation`/`useUpdateAutomationRuleMutation`, never-optimistic (mirrors `use-sla-policies.ts`).
15. **New `apps/web/src/components/automation-rules/automation-rules-view.tsx`** — list + create form + an `isActive` toggle per row, mirroring `SlaPoliciesView`'s exact shape. The create form's "assign to" picker reuses `useUsersQuery()` (already fetches this branch's users).
16. **New `apps/web/src/app/[locale]/(agent)/automation-rules/page.tsx`** — one-line pass-through.
17. **`apps/web/src/components/workspace/workspace-nav.tsx`** — append `{ href: "automation-rules", labelKey: "nav.automationRules" }` as the new last entry.
18. **i18n** — `apps/web/messages/{en,ar}.json`: `workspace.nav.automationRules` + a new top-level `automationRules` namespace.
19. **Tests** — see Test Plan.

---

## API contract

- `POST /automation-rules` — `automation:create` — `{ name, conditionCategory?, actionAssignToUserId }` → the created rule; 404 if `actionAssignToUserId` isn't a real user in this branch.
- `GET /automation-rules` — `automation:read` — every rule in the caller's branch.
- `GET /automation-rules/:id` — `automation:read` — 404 for unknown/out-of-branch.
- `PATCH /automation-rules/:id` — `automation:update` — any subset of `{ name, conditionCategory, actionAssignToUserId, isActive }`.

## Tests

**Backend unit** (new `automation-rules.service.spec.ts`): CRUD scoping/404s, mirrors `sla-policies.service.spec.ts`'s own shape; `actionAssignToUserId` validated against `userBranchRole`.

**Backend unit** (new `automation-evaluation.listener.spec.ts`): matches the correct rule (category match, then wildcard fallback), skips when the ticket is already assigned, skips when no active rule matches, catches and logs a Prisma failure without rethrowing.

**Backend unit** (new `automation-action.listener.spec.ts`, in `tickets/`): applies the assignment, skips if the ticket became assigned in the meantime, emits `TICKET_UPDATED_EVENT`, catches and logs.

**Backend e2e** (new `automation-rules.e2e-spec.ts`): real rule creation, real ticket creation matching a category-scoped rule → real `assignedToUserId` reflected (polling, mirrors `sla-targets.e2e-spec.ts`'s fire-and-forget pattern) and a real history entry for it; a wildcard (`conditionCategory: null`) rule; an explicitly-assigned ticket is never reassigned; 403 for an Agent lacking `automation:*`.

**Frontend component**: list/create/toggle-active states.

## Regression requirements

Every existing test suite remains green, unweakened.

## Migration requirements

One migration: new `automation_rules` table. No existing table altered.

## Security risks/mitigations

- **Branch isolation**: identical `TenantContext.requireBranchScope()` mechanism as every other branch-scoped resource.
- **New permission surface**: `automation:*` gates all four routes; no existing permission's meaning changes.
- **No SLA-target desync risk**: Design decision 1 excludes every SLA-policy-matching field from the action set.
- **No silent override of a human's explicit assignment**: Design decision 5.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `AutomationRule` exists, migration applied.
- [ ] CRUD routes exist, permission-correct, branch-scoped.
- [ ] A real `ticket.created` event correctly triggers a matching active rule's assignment, and never overrides an explicit one.
- [ ] The automated assignment is visible in the ticket's history/timeline.
- [ ] New Agent Workspace screen renders list/create/toggle correctly.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Additional trigger types beyond `ticket.created`; actions beyond auto-assignment (no category/priority/department actions — see Design decision 1); rule-priority/ordering UI; a multi-condition DSL; AI-assisted rule suggestions; a full workflow engine.
- Any README change.
