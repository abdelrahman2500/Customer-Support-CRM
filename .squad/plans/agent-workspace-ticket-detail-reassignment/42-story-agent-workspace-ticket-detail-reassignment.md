# Story 42 — Agent Workspace: Ticket Detail — Subject & Department Reassignment

## Prerequisites

- `ticketing` Story 07/09: `Ticket.departmentId`, `UpdateTicketDto.subject`/`departmentId` — both accepted by the real `PATCH /tickets/:id` since the ticket foundation, never consumed by any frontend.
- `agent-workspace-ticket-operations-mvp` Story 23: `TicketDetailView` itself, and the blur-commit/`Select`-mutation conventions this story extends verbatim (category's `Input` blur-commit; status/priority/assignedAgent's `Select`).
- `identity-branch-department-listing` Story 35 / `agent-workspace-user-admin` Story 38: `GET /identity/departments` and its frontend `useDepartmentsQuery()` hook (`apps/web/src/hooks/use-tickets.ts`) — already implemented, already consumed by `CreateUserView`'s department picker. This story is the second consumer, not the first.

---

## Story Goal

Let an agent correct a ticket's subject and reassign its department from the Ticket Detail screen — the only two fields `PATCH /tickets/:id` already accepts that this screen doesn't yet expose. Confirmed this planning pass: `ticket-detail-view.tsx`'s heading renders `{ticket.subject}` as static text with no edit path anywhere, and `ticket.departmentId` is not read, rendered, or mutated anywhere in the component at all — not even read-only.

**Not in scope**: anything about ticket *creation* (Story 43/"A3" — `contactId`/`departmentId`/`assignedToUserId` at creation time — is a separate, deliberately sequenced-after story, since `UpdateTicketDto` has no `contactId` field at all and this PATCH-only story structurally cannot touch it), any change to `TicketsController`/`TicketsService`/DTOs, and no workspace navigation menu.

---

## Context — Read These Files First

1. `apps/web/src/components/tickets/ticket-detail-view.tsx` — the exact patterns this story extends: `Field` wrapper component; blur-commit `Input` (the existing `category` field, lines ~150-160); `Select`-onValueChange-mutate (status/priority/assignedAgent, lines ~114-178); the existing `mutation.isError` → 403-vs-generic inline `Alert` (lines 105-111); the static `<h1>{ticket.subject}</h1>` heading (line 92) this story converts to an editable field.
2. `apps/web/src/components/customers/customer-detail-view.tsx` — the **exact existing precedent** for "make a heading-position field editable": `displayNameDraft` state + `<Input className="w-56 text-lg font-semibold" defaultValue={customer.displayName} onChange={...} onBlur={...} />` replacing what would otherwise be a static customer-name heading. This story mirrors that pattern for the ticket subject, not a new one.
3. `apps/web/src/hooks/use-tickets.ts` — confirmed this planning pass: `useDepartmentsQuery()` (added by Story 38, `staleTime: 5*60_000`) already exists and returns `DepartmentSummary[] = {id, branchId, name}[]`, scoped server-side to the caller's own branch (`identity.service.ts`'s `listDepartments()`). Reused verbatim — no new hook.
4. `apps/web/src/components/users/create-user-view.tsx` — the existing precedent for a department `Select` sourced from `useDepartmentsQuery()`, including its `departmentsQuery.isError` inline load-error message convention (lines ~134-152) — mirrored for this story's department field.
5. `apps/api/src/modules/tickets/dto/update-ticket.dto.ts` — confirmed this planning pass: `subject?: string` (`@IsString() @MinLength(1)`), `departmentId?: string` (`@IsUUID()`), both already present, unchanged since Story 07/09. No `contactId` field exists on this DTO at all (confirmed — the reason Story 43 must handle contact-linking at creation instead).
6. `apps/web/src/lib/tickets-api.ts` — `UpdateTicketInput` (currently `{status?, priority?, category?, assignedToUserId?}`) and `TicketSummary` (already has `departmentId: string | null`, already fetched by `GET /tickets/:id` — only never rendered).
7. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx` — existing test conventions this story's new tests extend: `queryResult()` helper, `next/navigation`/`next-intl` mocks, `useUpdateTicketMutation` mock shape (`{mutate, isError, error}`).

---

## Design (resolved during this planning pass)

1. **Subject becomes an editable heading, mirroring `CustomerDetailView`'s displayName field exactly** — not a new `Field` grid entry. The static `<h1>{ticket.subject}</h1>` is replaced by a blur-commit `Input` styled to preserve the heading's visual weight (`text-lg font-semibold`), with a local `subjectDraft` state identical in shape to `CustomerDetailView`'s `displayNameDraft`: committed only on blur, only when non-empty and changed (mirrors `UpdateTicketDto.subject`'s `@MinLength(1)` — an empty subject is never sent, matching this codebase's established "no invented clear-to-empty behavior for a required-shaped field" rule already applied to `fullName`/`displayName` elsewhere).
2. **Department becomes a fifth `Field` in the existing grid**, using a `Select` sourced from `useDepartmentsQuery()` — the same hook, same `.isError` inline-message convention `CreateUserView`'s department picker already established. Mirrors the existing `assignedAgent` field's own accepted shape exactly: `value={ticket.departmentId ?? undefined}`, a placeholder (`t("detail.noDepartment")`) shown via `SelectValue` when null, and no explicit "unassign/clear department" option — the same limitation `assignedAgent` already has today (an agent can reassign to a different department, not clear it to "none"; introducing a clear-to-null affordance the existing assignee field doesn't have would be a new, unrequested pattern, not a mirror of one).
3. **Both fields commit through the existing single `useUpdateTicketMutation(ticketId)`** — no second mutation hook, no new endpoint. `UpdateTicketInput` gains `subject?: string` and `departmentId?: string`, mirroring `UpdateTicketDto` field-for-field (Design item established by every prior `*Input`-mirrors-`*Dto` type in this file).
4. **Never optimistic, same 403-vs-generic distinction, unchanged.** Both new mutations flow through the exact same `mutation.isError` `Alert` block already rendering above the field grid — no new error-handling branch, since a rejected subject/department update is indistinguishable, from the UI's point of view, from a rejected status/priority/category/assignee update today.
5. **README**: the existing root `README.md` already tracks ticket-detail's editable-field set in one sentence under "Agent Workspace" (*"ticket detail (customer info, SLA target, history, and status/priority/category/assignment actions)"*). This story extends that exact sentence to read *"...and status/priority/category/subject/department/assignment actions"* — the smallest accurate edit possible. This story does **not** touch the README's stale "through Story 32" header, its "Status by story" list (which stops at 32 and separately still marks Story 31 as a "known gap" despite Story 31 now being present in the repository), or any other section — that broader staleness spans nine unrelated already-shipped stories (33–41) and is out of this story's scope to reconcile.

---

## Implementation Tasks

### 1 — `apps/web/src/lib/tickets-api.ts` (modify)

- Extend `UpdateTicketInput` additively:
  ```ts
  export interface UpdateTicketInput {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: string;
    assignedToUserId?: string;
    subject?: string;
    departmentId?: string;
  }
  ```
  No change to `updateTicket()` itself (already forwards the whole input as-is).

### 2 — `apps/web/src/components/tickets/ticket-detail-view.tsx` (modify)

- Import `useDepartmentsQuery` from `@/hooks/use-tickets` and `DepartmentSummary` type from `@/lib/tickets-api` (only if needed for typing the map — likely inferred).
- Add `departmentsQuery = useDepartmentsQuery()`.
- Add `subjectDraft` state (`string | null`, mirroring `categoryDraft`'s shape).
- Replace the static `<h1>{ticket.subject}</h1>` with a blur-commit `Input` (mirrors `CustomerDetailView`'s displayName field): commits `{ subject: trimmedValue }` on blur only if non-empty and changed from `ticket.subject`.
- Add a fifth `Field` (department) to the existing grid: a `Select` over `departmentsQuery.data ?? []`, `value={ticket.departmentId ?? undefined}`, placeholder `t("detail.noDepartment")`, `onValueChange={(value) => mutation.mutate({ departmentId: value })}`; an inline `t("detail.departmentLoadError")` message when `departmentsQuery.isError` (mirrors `CreateUserView`'s department-load-error convention).

### 3 — i18n

New keys under the existing `tickets.detail` namespace in `apps/web/messages/{en,ar}.json` (additive only — no existing key touched):
- `subjectLabel` (aria-label for the now-editable subject field, since the visible heading itself no longer doubles as a semantic label once it's an `<input>` — mirrors `CustomerDetailView`'s `displayNameLabel`)
- `department` (the field's visible label, mirroring `assignedAgent`'s naming)
- `noDepartment` (Select placeholder for a ticket with no department)
- `departmentLoadError` (mirrors `CreateUserView`'s `create.departmentLoadError` wording or "departmentLoadError")

### 4 — Tests (`ticket-detail-view.spec.tsx`, modify — extend the existing file, same conventions)

- Mock `useDepartmentsQuery` in the existing `@/hooks/use-tickets` `vi.mock` block (extend, don't replace).
- New cases:
  - Renders the subject as an editable input reflecting `ticket.subject` (via `getByDisplayValue`, mirroring `UserListView`'s spec conventions).
  - Commits `{ subject: <new value> }` on blur when changed.
  - Does not commit when the subject field is blurred unchanged, or blurred empty (mirrors the existing "no commit when unchanged" pattern already used for contacts/policies elsewhere in this codebase).
  - Renders the department `Select` reflecting `ticket.departmentId`, with the real department name resolved from `useDepartmentsQuery()`'s data.
  - Commits `{ departmentId: <new value> }` on selecting a different department.
  - Renders `detail.departmentLoadError` when `departmentsQuery.isError`.
  - Existing 403-vs-generic mutation-error tests remain unmodified and green (same `mutation.isError` block, no new branch).

### 5 — README (modify — one sentence)

- In `README.md`'s "Agent Workspace" bullet under "Current state", change *"...status/priority/category/assignment actions..."* to *"...status/priority/category/subject/department/assignment actions..."*. No other line touched.

---

## Edge Cases & Failure Modes

- **Subject blurred empty**: reverts to the last known-good value, mirroring `displayName`'s existing "never send an empty value for a required-shaped field" rule — never sent, no error shown (client-side no-op, same as today's unchanged-value no-op).
- **Department update rejected** (403/other): the existing `mutation.isError` `Alert` renders inline, distinguishing 403 from generic exactly as it already does for every other field on this screen — no new error path.
- **`GET /identity/departments` fails**: an inline `departmentLoadError` message renders next to the picker; the Select still renders (empty options), consistent with `CreateUserView`'s existing handling of the same failure.
- **A ticket with no department (`departmentId: null`)**: the Select shows the `noDepartment` placeholder via `SelectValue`, exactly mirroring how `assignedAgent` already shows `list.unassigned` for a null `assignedToUserId` today.

---

## Test Plan

1. **Unit/component**: as listed in Implementation Task 4 — extends the existing `ticket-detail-view.spec.tsx`, all existing cases remain green.
2. **Regression**: full existing `apps/web` suite remains green — this story modifies exactly two existing files (`tickets-api.ts`, `ticket-detail-view.tsx`) plus its own spec and the README; every other existing consumer of `UpdateTicketInput`/`TicketDetailView` is exercised by the existing suite already. `apps/api`/`apps/worker` unaffected — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change, no new/changed backend endpoint. Rollback is a plain code revert of `tickets-api.ts`, `ticket-detail-view.tsx`, its spec, and the one README sentence.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): fetch a real ticket, `PATCH` its subject and departmentId via the real `PATCH /tickets/:id`, re-fetch to confirm persistence, confirm a real `GET /identity/departments` populates the picker with real department names.
4. `pnpm --filter @crm/api test:e2e` — regression only (no backend file touched).
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, and every existing `apps/web` file **other than** `tickets-api.ts`, `ticket-detail-view.tsx`, `ticket-detail-view.spec.tsx`, `messages/{en,ar}.json`, and `README.md` have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] An agent can edit a ticket's subject from Ticket Detail; the change persists via the real `PATCH /tickets/:id` and is reflected on reload.
- [ ] An agent can reassign a ticket's department from Ticket Detail, chosen from the real `GET /identity/departments` list; the change persists via the real `PATCH /tickets/:id`.
- [ ] Neither field is ever committed optimistically; a rejected mutation renders the same 403-vs-generic inline message every other field on this screen already uses.
- [ ] An empty subject is never sent.
- [ ] No new backend endpoint, DTO field, permission, Prisma model, migration, or business rule.
- [ ] No change to ticket creation (`create-ticket-view.tsx`/`CreateTicketInput`) — Story 43's scope, not this one.
- [ ] No workspace navigation change.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] `README.md` updated with the single sentence described above — no other README section touched.
- [ ] Unit/component tests exist and pass for both new fields; existing tests remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

## Non-Goals (explicit)

- Ticket creation's `contactId`/`departmentId`/`assignedToUserId` pickers (Story 43/"A3") — structurally can't be done here (`UpdateTicketDto` has no `contactId`), and deliberately sequenced after this story since both touch `tickets-api.ts`.
- A "clear department to none" affordance — the existing `assignedAgent` field has no equivalent "clear to unassigned" control either; not introduced here as a new, unrequested pattern.
- Any backend change, any new endpoint, any new permission.
- A persistent workspace navigation menu.
- Reconciling the README's pre-existing staleness beyond the one sentence this story's own capability touches (the "through Story 32" header, the Story 31 "known gap" note, and the missing 33–41 entries are unrelated to this story and are not fixed here).

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
