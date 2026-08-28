# Story 43 — Agent Workspace: Ticket Creation — Contact / Department / Assignee

## Prerequisites

- `ticketing` Story 07/25: `CreateTicketDto.contactId`/`departmentId`/`assignedToUserId` — all accepted by the real `POST /tickets` since ticket creation was built, never consumed by any frontend. Confirmed this planning pass by reading `create-ticket.dto.ts` directly: all three are `@IsOptional() @IsUUID()`.
- `agent-workspace-customer-management` Story 26: `useCustomerQuery(id)` (`apps/web/src/hooks/use-tickets.ts`) — `GET /customers/:id` already returns `contacts: ContactSummary[]` embedded (confirmed via `tickets-api.ts`'s `CustomerDetail` type). No second contacts endpoint exists or is needed.
- `identity-branch-department-listing` Story 35 / `agent-workspace-user-admin` Story 38: `useDepartmentsQuery()` — already implemented, already consumed by `CreateUserView`'s and (as of Story 42) `TicketDetailView`'s department pickers. This story is a third consumer, not the first.
- `agent-workspace-ticket-operations-mvp` Story 23: `useUsersQuery()` — already implemented, already consumed by `TicketListView`'s filter and `TicketDetailView`'s assignee picker.
- `agent-workspace-ticket-detail-reassignment` Story 42: the complementary, already-shipped half of this same DTO-completion effort (`UpdateTicketDto.subject`/`departmentId`). Already merged — not concurrent with this story.

---

## Story Goal

Let an agent pick a specific contact, department, and assignee **at ticket-creation time**, closing the last three unconsumed fields on `CreateTicketDto`. Confirmed this planning pass, by reading the current files directly (not assumed from prior recon): `create-ticket-view.tsx`'s own doc comment still states *"contactId/departmentId/assignedToUserId are never sent"*, and `CreateTicketInput` in `tickets-api.ts` is still exactly `{customerId, subject, category?, priority?}`.

**Why this is a distinct story from Story 42, not an extension of it**: `UpdateTicketDto` has no `contactId` field at all (confirmed again this pass) — contact-linking can only ever happen at creation. Department and assignee, by contrast, are already editable post-creation (Story 42 added department; assignee has been editable since Story 23) — this story adds the complementary "pick them up front instead of a two-step create-then-edit flow" capability for those two, and the *only* possible path for the third (contact).

**Not in scope**: automatic assignment/routing logic (this is manual selection only, exactly as `assignedToUserId` already works via `TicketDetailView`'s picker — no new business rule), any change to `TicketsController`/`TicketsService`/DTOs, any change to Ticket Detail (Story 42's surface, already shipped), Customer Portal, Communication Channels, role/permission changes, and no workspace navigation menu.

---

## Context — Read These Files First

1. `apps/web/src/components/tickets/create-ticket-view.tsx` — the exact form this story extends: plain `useState` (no form/validation library, Story 25's own established shape), the `UNSET_PRIORITY` sentinel pattern for an optional `Select`, the conditional-spread payload-construction pattern (`...(category.trim() ? {category: category.trim()} : {})`), and the Story 27 `prefilledCustomerId` effect that seeds `customerId` without disturbing the rest of the form.
2. `apps/web/src/components/tickets/create-ticket-view.spec.tsx` — confirmed this planning pass: one existing test asserts an **exact** payload via `toHaveBeenCalledWith({customerId, subject, category})` — deep-equality, not partial match. This story's new optional fields must therefore never appear in that payload when unset, which the existing conditional-spread pattern already guarantees; this test requires **no change**.
3. `apps/web/src/hooks/use-tickets.ts` — confirmed this planning pass: `useCustomerQuery(id: string)` (Story 26) has no `enabled` guard and exactly one existing consumer, `CustomerDetailView` (confirmed via `grep` — the only non-test call site), which always passes a real route-param id. Calling it with `customerId === ""` (before any customer is chosen) would fire a real, wasted `GET /customers/` request. `useDepartmentsQuery()` (Story 38) and `useUsersQuery()` (Story 23) are both already unconditionally safe to call (no per-id parameter).
4. `apps/web/src/components/users/create-user-view.tsx` — the existing precedent for an optional `Select` sourced from `useDepartmentsQuery()` with an explicit `UNSET_DEPARTMENT` sentinel item and an inline `.isError` load-error message — mirrored here for both the new department and assignee fields.
5. `apps/web/src/components/tickets/ticket-detail-view.tsx` (Story 42) — the existing precedent for an assignee `Select` sourced from `useUsersQuery()`, and (as of Story 42) a department `Select` sourced from `useDepartmentsQuery()` with an inline load-error message — the same conventions, applied here to a *create* form's optional fields instead of an *update* form's always-set fields.
6. `apps/api/src/modules/tickets/dto/create-ticket.dto.ts` — confirmed this planning pass: `contactId?`/`departmentId?`/`assignedToUserId?` all `@IsOptional() @IsUUID()`, unchanged since Story 07/25.
7. `apps/web/src/lib/tickets-api.ts` — confirmed this planning pass: `CreateTicketInput` currently `{customerId, subject, category?, priority?}`; `CustomerDetail` already has `contacts: ContactSummary[]` embedded (Story 26).
8. `README.md`, the **"Ticket & customer creation"** bullet (confirmed this planning pass, line ~47-53) — the exact sentence this story's README update targets, mirroring Story 42's own precedent of a single, capability-scoped edit.

---

## Design (resolved during this planning pass)

1. **`useCustomerQuery` gets one small, backward-compatible `enabled` guard — not a new hook.** Add `enabled: Boolean(id)` (or equivalent) to its existing `useQuery` call in `use-tickets.ts`. `CustomerDetailView` (the only other consumer) always passes a truthy route-param id, so `Boolean(id)` is always `true` there — zero behavior change for it. This lets `CreateTicketView` call the same hook with `customerId` (which starts as `""`) without firing a real, invalid `GET /customers/` request before any customer is chosen.
2. **Contact selection is conditional on a customer being selected, and resets whenever the customer changes.** A new `<Select>` for contacts renders only when `customerId` is truthy, sourced from `useCustomerQuery(customerId).data?.contacts ?? []` — no new API call, no new hook, exactly the embedded-contacts shape Story 26 already established. The existing `onValueChange={setCustomerId}` on the customer picker is replaced by a small `handleCustomerChange` that sets `customerId` **and** resets `contactId` back to unset — preventing a customer-A contact id from being silently submitted against customer B (this is the one behavior this story must get right per the intake's explicit emphasis). `UNSET_CONTACT` sentinel + an explicit "no specific contact" option, mirroring `UNSET_PRIORITY`'s existing shape in this exact file — not a new pattern.
3. **Department and assignee are independent optional `Select`s, not customer-scoped.** `useDepartmentsQuery()` and `useUsersQuery()` are called unconditionally (both already safe to call with no arguments, both already cached elsewhere in the app) with their own `UNSET_DEPARTMENT`/`UNSET_ASSIGNEE` sentinels — mirroring `CreateUserView`'s department picker and `TicketDetailView`'s assignee picker exactly.
4. **Inline load-error messages per related-entity picker**, mirroring `CreateUserView`'s `branchLoadError`/`departmentLoadError`/`roleLoadError` convention exactly: `customerQuery.isError` (contacts) → `t("create.contactsLoadError")`; `departmentsQuery.isError` → `t("create.departmentLoadError")`; `usersQuery.isError` → `t("create.assignedAgentLoadError")`. None of these block submission — they're informational, matching every existing instance of this pattern.
5. **Payload construction extends the existing conditional-spread pattern, unchanged in spirit**: `...(contactId !== UNSET_CONTACT ? {contactId} : {})`, `...(departmentId !== UNSET_DEPARTMENT ? {departmentId} : {})`, `...(assignedToUserId !== UNSET_ASSIGNEE ? {assignedToUserId} : {})` — added alongside the existing `category`/`priority` spreads. Verified this pass: when none of the three new fields are touched, the resulting payload is byte-identical to today's `{customerId, subject, category?}`, so the existing exact-equality test (Context item 2) needs no change.
6. **No automatic assignment, no routing logic.** `assignedToUserId` is a manual pick from the same `useUsersQuery()` list `TicketDetailView` already uses — this story adds a *third* place a human chooses an assignee, not a new decision-making system.
7. **README**: the existing **"Ticket & customer creation"** bullet currently states contact/department/assignee "are never sent." This story updates that one bullet to describe the new optional pickers — the same capability-scoped, single-paragraph edit discipline Story 42 established. No other README section (the stale "through Story 32" header, the Story 31 "known gap" note, the missing 33-42 story-status entries) is touched — unrelated to this story, exactly as Story 42's own plan reasoned.

---

## Implementation Tasks

### 1 — `apps/web/src/lib/tickets-api.ts` (modify)

- Extend `CreateTicketInput` additively:
  ```ts
  export interface CreateTicketInput {
    customerId: string;
    subject: string;
    category?: string;
    priority?: TicketPriority;
    contactId?: string;
    departmentId?: string;
    assignedToUserId?: string;
  }
  ```
  No change to `createTicket()` itself (already forwards the whole input as-is).

### 2 — `apps/web/src/hooks/use-tickets.ts` (modify — one line)

- `useCustomerQuery(id: string)`: add `enabled: Boolean(id)` to its `useQuery` options. No other change; `CustomerDetailView`'s usage is unaffected (always a truthy id).

### 3 — `apps/web/src/components/tickets/create-ticket-view.tsx` (modify)

- Add `useCustomerQuery` (aliased or imported alongside `useCustomersQuery`), `useDepartmentsQuery`, `useUsersQuery` imports from `@/hooks/use-tickets`.
- Add state: `contactId` (default `UNSET_CONTACT`), `departmentId` (default `UNSET_DEPARTMENT`), `assignedToUserId` (default `UNSET_ASSIGNEE`).
- Add `UNSET_CONTACT`, `UNSET_DEPARTMENT`, `UNSET_ASSIGNEE` sentinel constants (`"__unset__"`, mirroring the existing `UNSET_PRIORITY`).
- Replace the customer picker's `onValueChange={setCustomerId}` with a `handleCustomerChange(value)` that sets `customerId` and resets `contactId` to `UNSET_CONTACT`.
- Add `customerDetailQuery = useCustomerQuery(customerId)` (safe now per Task 2's `enabled` guard).
- Conditionally render a contact `Select` (only when `customerId` is truthy): options from `customerDetailQuery.data?.contacts ?? []`, an explicit `UNSET_CONTACT` "no specific contact" item, inline `customerDetailQuery.isError` → `contactsLoadError` message.
- Add a department `Select` (unconditional): options from `useDepartmentsQuery().data ?? []`, `UNSET_DEPARTMENT` item, inline load-error message.
- Add an assignee `Select` (unconditional): options from `useUsersQuery().data ?? []`, `UNSET_ASSIGNEE` item, inline load-error message.
- Extend the `mutateAsync` payload with the three new conditional spreads (Design item 5).

### 4 — i18n

New keys under the existing `tickets.create` namespace in `apps/web/messages/{en,ar}.json` (additive only):
- `contact`, `noContactOption` (sentinel label), `contactsLoadError`
- `department`, `departmentDefault` (sentinel label, mirrors `users.create.departmentDefault`'s "No department" wording), `departmentLoadError`
- `assignedAgent`, `assignedAgentDefault` (sentinel label, e.g. "Unassigned" — mirrors `tickets.list.unassigned`), `assignedAgentLoadError`

### 5 — Tests (`create-ticket-view.spec.tsx`, modify — extend the existing file, same conventions)

- Extend the `@/hooks/use-tickets` `vi.mock` block with `useCustomerQuery`, `useDepartmentsQuery`, `useUsersQuery`.
- Add default `beforeEach` mocks for all three (empty/success), so every *existing* test continues to render exactly as before.
- New cases:
  - No contact picker is rendered before a customer is selected.
  - Selecting a customer with contacts reveals the contact picker, populated with that customer's real contacts.
  - Selecting a different customer afterward resets any previously chosen contact back to unset (the core "no stale contact" behavior).
  - A customer with zero contacts shows only the "no specific contact" option (no crash, no extra messaging).
  - Submitting with a chosen contact/department/assignee sends exactly `{customerId, subject, category?, priority?, contactId?, departmentId?, assignedToUserId?}` — only the fields actually chosen.
  - The existing exact-payload test (Context item 2) is asserted to remain **unmodified and green** — proof the base case is unaffected.
  - Inline load-error messages render for each of the three pickers when their respective query `isError`s.

### 6 — README (modify — one paragraph)

- Update the **"Ticket & customer creation"** bullet to describe the new optional contact/department/assignee pickers at creation time, replacing the "are never sent" sentence with an accurate description — no other bullet or section touched.

---

## Data Flow (explicit, per the intake's emphasis)

- **Customer → contacts**: `customerId` (state) → `useCustomerQuery(customerId)` (now `enabled`-guarded) → `.data.contacts` (already embedded, Story 26) → contact `Select` options. No new endpoint, no new hook.
- **Customer changes**: `handleCustomerChange` sets the new `customerId` and unconditionally resets `contactId` to `UNSET_CONTACT` in the same handler — synchronous, no effect/race window where a stale contact could survive a customer switch.
- **Department selection**: independent of customer; `useDepartmentsQuery()` → `Select` options; no reset needed on customer change (departments are branch-wide, not customer-scoped).
- **Assignee selection**: independent of customer; `useUsersQuery()` → `Select` options; no reset needed.
- **Customer has no contacts**: the contact `Select` renders with only the `UNSET_CONTACT` "no specific contact" item — no error, no empty-state message (a customer legitimately having no contacts is not a failure state).
- **Mutation payload**: only fields the agent actually touched are included — `customerId`/`subject` always; `category`/`priority`/`contactId`/`departmentId`/`assignedToUserId` only when not left at their default/unset value.

---

## Edge Cases & Failure Modes

- **Customer switched after picking a contact**: contact resets to unset (Design item 2) — never silently submits a contact belonging to a different customer.
- **`GET /customers/:id` (contacts) / `GET /identity/departments` / `GET /identity/users` each fail independently**: each picker shows its own inline load-error message; the other two pickers and the rest of the form are unaffected — mirrors the existing multi-independent-query convention already used elsewhere (e.g. `CustomerDetailView`'s Contacts vs. Related Tickets cards).
- **Customer has zero contacts**: contact picker shows only "no specific contact" — not an error.
- **Rejected submission** (any reason): existing `ApiError`-message-inline behavior, unchanged — entered values (including chosen contact/department/assignee) are preserved for retry, since nothing is cleared until a real success.
- **A ticket created with no contact/department/assignee chosen**: identical payload/behavior to today — this story adds capability, it doesn't change any default.

---

## Test Plan

1. **Unit/component**: as listed in Implementation Task 5 — extends the existing `create-ticket-view.spec.tsx`; every existing test (including the exact-payload assertion) remains green, unmodified.
2. **Regression**: full existing `apps/web` suite remains green — this story modifies `tickets-api.ts`, `use-tickets.ts` (one line, backward-compatible), `create-ticket-view.tsx`, its spec, i18n, and one README paragraph. `apps/api`/`apps/worker` unaffected — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change, no new/changed backend endpoint. Rollback is a plain code revert of the five modified files plus the one README paragraph.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): create a real ticket with a real `contactId`/`departmentId`/`assignedToUserId` via the real `POST /tickets`, re-fetch it to confirm persistence of all three; confirm a real `GET /customers/:id` still returns embedded contacts for the picker.
4. `pnpm --filter @crm/api test:e2e` — regression only (no backend file touched).
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, `ticket-detail-view.tsx`, `workspace-nav.tsx`, and every existing `apps/web` file **other than** `tickets-api.ts`, `use-tickets.ts`, `create-ticket-view.tsx`, `create-ticket-view.spec.tsx`, `messages/{en,ar}.json`, and `README.md` have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] An agent can select a specific contact when creating a ticket, scoped to the chosen customer's real contacts (via the already-embedded `GET /customers/:id` response).
- [ ] Switching the selected customer clears any previously chosen contact — no stale cross-customer contact is ever submittable.
- [ ] An agent can select a department and/or an assignee at ticket-creation time, both optional, both via the real `POST /tickets`.
- [ ] Omitting all three fields produces the exact same payload/behavior as today (verified by the existing, unmodified exact-payload test).
- [ ] Each of the three optional pickers shows its own inline load-error message on failure, independent of the others.
- [ ] No new backend endpoint, DTO field, permission, Prisma model, migration, or business rule. No automatic assignment/routing logic introduced.
- [ ] No change to `ticket-detail-view.tsx`, `workspace-nav.tsx`, or any backend file.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] `README.md`'s "Ticket & customer creation" bullet is updated to reflect the new capability — no other README section touched.
- [ ] Unit/component tests exist and pass for all new behavior; every existing test remains green, unmodified where not directly affected.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

## Sequencing / File-Overlap Considerations

- No other story is currently in-flight or planned that touches `tickets-api.ts`, `use-tickets.ts`, or `create-ticket-view.tsx` — Story 42 (the only recent story sharing `tickets-api.ts`) has already merged. No parallel-safety conflict exists at this time.
- This story must not be parallelized with any future story that also extends `CreateTicketInput`/`create-ticket-view.tsx`, per this project's established "no intentional shared-file overlap between parallel stories" rule.

## Risks and Mitigations

- **Risk**: a stale contact from a previously-selected customer gets submitted. **Mitigation**: `contactId` reset is synchronous and co-located in the same `handleCustomerChange` handler that updates `customerId` — no window for a stale value, covered by an explicit test.
- **Risk**: `useCustomerQuery`'s new `enabled` guard subtly changes `CustomerDetailView`'s behavior. **Mitigation**: confirmed via `grep` that it is the only other consumer and always passes a truthy id, so `Boolean(id)` is always `true` there — no behavior change; also, `CustomerDetailView`'s own spec mocks the hook at the module boundary and never exercises the real implementation, so it cannot be affected either way.
- **Risk**: the existing exact-payload equality test breaks. **Mitigation**: the conditional-spread design (Design item 5) guarantees byte-identical payload shape when the three new fields are left unset — explicitly verified in the plan, not assumed.

---

## Non-Goals (explicit)

- Automatic assignment/routing logic — `assignedToUserId` here is a manual pick, identical in kind to `TicketDetailView`'s existing assignee picker, not a new decision system.
- Any change to Ticket Detail (`ticket-detail-view.tsx`) — Story 42's surface, already shipped, untouched here.
- Customer Portal, Communication Channels, role/permission changes, a persistent workspace navigation menu.
- Any backend change, any new endpoint, any new permission.
- Reconciling the README's pre-existing, unrelated staleness beyond the one paragraph this story's own capability touches.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
