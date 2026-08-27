# Story 31 — Agent Workspace: SLA Policy Management

## Prerequisites

- `sla-policy-foundation` Story 10 completed: `SlaPolicy` model, `SlaPoliciesController` (full CRUD), `sla:create`/`sla:read`/`sla:update` permissions. Never previously consumed by any frontend.

---

## Story Goal

Give the Agent Workspace a real SLA policy management screen — list, inline-edit, and create — over the already-complete `SlaPoliciesController` CRUD, as an entirely new, independent route/component surface.

**Not in scope**: business-hours calendar configuration UI, any change to SLA target computation/timer/escalation logic, a persistent cross-screen navigation menu, any new backend endpoint/DTO/permission/model/migration.

---

## Context — Read These Files First

1. `apps/api/src/modules/sla-policies/sla-policies.controller.ts` and its DTOs (`create-sla-policy.dto.ts`, `update-sla-policy.dto.ts`) — confirmed this planning pass: `CreateSlaPolicyDto { departmentId?, category?, priority?, responseTargetMinutes!, resolutionTargetMinutes! }`; `UpdateSlaPolicyDto` (all optional, plus `isActive?`). Both gated by `sla:create`/`sla:read`/`sla:update`.
2. `apps/web/src/components/tickets/ticket-list-view.tsx` — the list/table/`Skeleton`/`Alert`/empty-state conventions this story's list mirrors; the inline blur-commit `category` field pattern (`ticket-detail-view.tsx`) this story's inline-edit cells mirror.
3. `apps/web/src/components/tickets/create-ticket-view.tsx` — the plain-`useState`-form convention this story's create form mirrors.
4. `apps/web/src/hooks/use-tickets.ts` — the never-optimistic mutation convention this story's own new hooks file mirrors (without importing from this file — see Design item 4).

---

## Design (resolved during this planning pass)

1. **A new top-level route**, `(agent)/sla-policies` (list) and `(agent)/sla-policies/new` (create form) — matching the existing flat `/tickets`, `/tickets/new`, `/customers`, `/customers/new` URL convention, not a nested "admin/" prefix.
2. **List with inline editing**, not list + separate detail page: each policy row shows its scoping (department/category/priority) read-only (scoping fields are not edited after creation — only the two target durations and `isActive` are, since changing scoping fields would change which tickets a policy applies to, a bigger behavior change than this story's "let people see and tune targets" goal) and editable `responseTargetMinutes`/`resolutionTargetMinutes` (blur-commit `Input`, mirroring `TicketDetailView`'s `category` field) plus an `isActive` toggle.
3. **Create form** (new route) collects `departmentId?`/`category?`/`priority?` (optional scoping) and both required target minutes, mirroring `CreateTicketView`'s plain-`useState` shape.
4. **Dedicated new files, zero shared-file overlap**: `apps/web/src/lib/sla-policies-api.ts` (types + `listSlaPolicies`/`getSlaPolicy`/`createSlaPolicy`/`updateSlaPolicy`) and `apps/web/src/hooks/use-sla-policies.ts` (`useSlaPoliciesQuery`/`useCreateSlaPolicyMutation`/`useUpdateSlaPolicyMutation`), mirroring `tickets-api.ts`/`use-tickets.ts`'s own conventions exactly but living in their own files — SLA policies are a distinct domain with no existing precedent forcing them into the shared files, unlike Customer/Contact/User.
5. **No navigation menu added** — no persistent nav bar exists anywhere in the Agent Workspace today; this screen is reached via direct URL, consistent with how every other screen already works.

---

## Implementation Tasks

### 1 — API client

File: `apps/web/src/lib/sla-policies-api.ts` (new)

- `SlaPolicySummary` type mirroring the backend's own (`id`, `branchId`, `departmentId`, `category`, `priority`, `responseTargetMinutes`, `resolutionTargetMinutes`, `isActive`, `createdAt`, `updatedAt`).
- `listSlaPolicies()`, `getSlaPolicy(id)`, `createSlaPolicy(input)`, `updateSlaPolicy(id, input)` — thin wrappers over `apiFetch`, mirroring `tickets-api.ts`'s existing shape.

### 2 — Hooks

File: `apps/web/src/hooks/use-sla-policies.ts` (new)

- `useSlaPoliciesQuery()`, `useCreateSlaPolicyMutation()`, `useUpdateSlaPolicyMutation(id)` — never-optimistic, invalidating `["sla-policies"]` on success.

### 3 — List view

File: `apps/web/src/components/sla-policies/sla-policy-list-view.tsx` (new) + `apps/web/src/app/[locale]/(agent)/sla-policies/page.tsx` (new)

- Loading/error/empty/populated states mirroring `TicketListView`'s conventions.
- Inline-editable target minutes + active toggle per row; "New policy" button → `sla-policies/new`.

### 4 — Create view

File: `apps/web/src/components/sla-policies/create-sla-policy-view.tsx` (new) + `apps/web/src/app/[locale]/(agent)/sla-policies/new/page.tsx` (new)

- Plain form (department/category/priority optional, both target minutes required), mirroring `CreateTicketView`.

### 5 — i18n

New top-level `slaPolicies.*` namespace in `apps/web/messages/{en,ar}.json` (list/create/columns/errors — exact keys decided at implementation time, following established naming style).

### 6 — Tests

New `sla-policy-list-view.spec.tsx` and `create-sla-policy-view.spec.tsx`, mirroring `ticket-list-view.spec.tsx`/`create-ticket-view.spec.tsx`'s conventions.

---

## Edge Cases & Failure Modes

- **An inline edit is rejected**: the field reverts to its last known-good value with an inline message — never assumed to have succeeded.
- **No SLA policies exist yet**: empty-state paragraph with a prominent "New policy" action, not an error.
- **A create submission is rejected**: entered values are preserved so the agent can retry without re-typing.

---

## Test Plan

1. **Unit/component**: as listed in Implementation Task 6.
2. **Regression**: full existing `apps/web` suite remains green (this story adds new files only; it does not modify any existing component/hook/lib file). `apps/api`/`apps/worker` unaffected — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change. Rollback is a plain code revert (delete the new files/routes).

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): real `GET /sla-policies`, real `POST /sla-policies`, real `PATCH /sla-policies/:id` against real seeded data, each re-fetched to confirm persistence.
4. `pnpm --filter @crm/api test:e2e` — regression only.
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, and every existing `apps/web` component/hook/lib file have empty diffs (this story only adds files).
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] `/sla-policies` lists every real policy in the branch via the real `GET /sla-policies`.
- [ ] Target minutes and active state are editable inline and persist via the real `PATCH /sla-policies/:id`.
- [ ] A new policy can be created via the real `POST /sla-policies`.
- [ ] No mutation is ever applied optimistically.
- [ ] No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or business rule.
- [ ] No existing `apps/web` file is modified — this story only adds new files.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass; existing tests remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
