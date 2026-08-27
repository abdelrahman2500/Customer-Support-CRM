# Story 30 — Agent Workspace: Customer & Contact Editing

## Prerequisites

- `customer-management` Story 06 completed: `Customer`/`Contact` models, `PATCH /customers/:id`, `POST/PATCH /customers/:id/contacts`, `customer:create`/`customer:update` permissions.
- `agent-workspace-customer-management` Story 26 completed: `CustomerDetailView`, `useCustomerQuery`. Extended, not replaced.

---

## Story Goal

Give the existing, read-only Customer Detail screen real edit capability: the customer's own `displayName`/`isActive`, plus add/edit for contacts — using only the already-complete `PATCH /customers/:id` and `POST/PATCH /customers/:id/contacts` contracts.

**Not in scope**: customer interaction history, notes/attachments, contact deletion (no `DELETE` endpoint exists), any change to `TicketListView`/`TicketDetailView`/`DashboardView`, any new backend endpoint/DTO/permission/model/migration.

---

## Context — Read These Files First

1. `apps/web/src/components/customers/customer-detail-view.tsx` (whole file, current state through Story 27) — the exact loading/error/content shape, Contacts card, and Related Tickets card this story adds edit affordances to.
2. `apps/web/src/components/tickets/ticket-detail-view.tsx` — the inline-edit-with-blur-commit convention (`category` field) and the `actionForbidden`/`actionFailed` 403-vs-generic distinction this story mirrors for the customer's own fields.
3. `apps/web/src/components/customers/create-customer-view.tsx` — the plain-`useState`-form convention (no form/validation library) this story's "add contact" form mirrors.
4. `apps/api/src/modules/customers/customers.controller.ts`, `contacts.controller.ts`, and their DTOs (`update-customer.dto.ts`, `create-contact.dto.ts`, `update-contact.dto.ts`) — confirmed this planning pass: `UpdateCustomerDto { displayName?, isActive? }`; `CreateContactDto { fullName!, email?, phone?, isPrimary? }`; `UpdateContactDto { fullName?, email?, phone?, isPrimary? }`. All gated by `customer:create`/`customer:update` — contacts have no independent permission namespace.
5. `apps/web/src/hooks/use-tickets.ts` — `useUpdateTicketMutation`'s never-optimistic invalidation convention, mirrored exactly by this story's three new mutations.

---

## Design (resolved during this planning pass)

1. **Customer fields (`displayName`, `isActive`) edit inline** on the existing header, mirroring `TicketDetailView`'s blur-commit `category` field for `displayName` and a toggle/select for `isActive` — no separate "edit mode" screen, no modal.
2. **Contacts get an inline "Add contact" form** (mirroring `CreateCustomerView`'s plain-`useState` shape) appended below the existing contacts list, and each existing contact row gains an inline edit affordance for its own fields — no separate route, no modal.
3. **Never optimistic**: all three new mutations (`useUpdateCustomerMutation`, `useCreateContactMutation`, `useUpdateContactMutation`) only invalidate `["customer", id]` (and `["customers"]` where the list view's cached data would otherwise go stale) after a real success response — identical convention to every existing mutation in this codebase.
4. **New API functions and hooks are purely additive** to the existing shared `tickets-api.ts`/`use-tickets.ts` files — no existing export is renamed, removed, or restructured. See "Parallel-batch overlap note" below.
5. **No new permission is invented** — contact routes already reuse `customer:create`/`customer:update`; a 403 renders the same `actionForbidden`-style message already established.

### Parallel-batch overlap note

This story is developed in parallel with Story 31 (`agent-workspace-sla-policy-admin`, zero overlap — dedicated new files) and Story 32 (`agent-workspace-user-admin`). **Story 32 also makes small, additive changes to `apps/web/src/lib/tickets-api.ts` and `apps/web/src/hooks/use-tickets.ts`** (widening `UserSummary`, adding `updateUser`/`useUpdateUserMutation`) — this is the only file overlap in the whole batch. Both stories' additions are new, distinctly-named exports appended to these files, not edits to each other's lines, so the practical conflict risk is low; if implemented by separate agents/sessions, the second to land should expect (and resolve) a trivial textual merge in these two files, not a logical conflict.

---

## Implementation Tasks

### 1 — API client additions

File: `apps/web/src/lib/tickets-api.ts`

- `updateCustomer(id: string, input: UpdateCustomerInput): Promise<{ id: string }>` — `PATCH /customers/:id`.
- `createContact(customerId: string, input: CreateContactInput): Promise<ContactSummary>` — `POST /customers/:id/contacts`.
- `updateContact(customerId: string, contactId: string, input: UpdateContactInput): Promise<{ id: string }>` — `PATCH /customers/:id/contacts/:contactId`.
- New input types mirroring the backend DTOs exactly: `UpdateCustomerInput { displayName?, isActive? }`, `CreateContactInput { fullName, email?, phone?, isPrimary? }`, `UpdateContactInput { fullName?, email?, phone?, isPrimary? }`.

### 2 — Hooks

File: `apps/web/src/hooks/use-tickets.ts`

- `useUpdateCustomerMutation(id)`, `useCreateContactMutation(customerId)`, `useUpdateContactMutation(customerId, contactId)` — each never-optimistic, invalidating `["customer", customerId]` (and `["customers"]` for the display-name/isActive case, since the Customer List shows both).

### 3 — `CustomerDetailView`

File: `apps/web/src/components/customers/customer-detail-view.tsx`

- Inline-editable `displayName` (blur-commit `Input`) and `isActive` (a `Select`/toggle), mirroring `TicketDetailView`'s field pattern; a rejected mutation renders the 403-vs-generic distinction inline.
- An "Add contact" form (fullName/email/phone/isPrimary) below the existing contacts list.
- Each existing contact row gains inline-editable fields for the same shape.

### 4 — i18n

Extend `apps/web/messages/{en,ar}.json`'s existing `customers.detail.*` with the new edit/add-contact strings (exact keys decided at implementation time, following the established naming style).

### 5 — Tests

Extend `customer-detail-view.spec.tsx`: customer-field edit success/403/generic-failure; add-contact success/failure; edit-contact success/failure — mirroring `ticket-detail-view.spec.tsx`'s (or equivalent) mutation-state test conventions.

---

## Edge Cases & Failure Modes

- **A customer-field edit is rejected (403 or otherwise)**: the field reverts to/stays at its last known-good server value, with an inline message — never assumed to have succeeded.
- **Adding a contact fails**: the form's entered values are preserved (not cleared) so the agent can retry without re-typing, matching `CreateCustomerView`'s existing error-preserves-input behavior.
- **Two edits to the same customer in quick succession**: the second mutation's own invalidation naturally reconciles state via a real re-fetch — no client-side merge logic invented.

---

## Test Plan

1. **Unit/component — `customer-detail-view.spec.tsx`**: as listed in Implementation Task 5.
2. **Regression**: full existing `apps/web` suite remains green, in particular every `customer-*`/`ticket-*` spec (the `tickets-api.ts`/`use-tickets.ts` additions are purely additive). `apps/api`/`apps/worker` unaffected (no backend files touched) — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change. Rollback is a plain code revert.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): real `PATCH /customers/:id`, real `POST /customers/:id/contacts`, real `PATCH /customers/:id/contacts/:contactId` against real seeded data, each re-fetched to confirm the change genuinely persisted.
4. `pnpm --filter @crm/api test:e2e` — regression only, confirms no backend change was required or made.
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, and every protected realtime/SLA/notification/ticket-screen file have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] Customer `displayName`/`isActive` are editable and persist via the real `PATCH /customers/:id`.
- [ ] A new contact can be added via the real `POST /customers/:id/contacts`.
- [ ] An existing contact can be edited via the real `PATCH /customers/:id/contacts/:contactId`.
- [ ] No mutation is ever applied optimistically.
- [ ] No new backend endpoint, DTO field, permission, Prisma model, migration, realtime event, or business rule.
- [ ] `RealtimeGateway` and listeners, every SLA-policies file, `schema.prisma`, migrations, `TicketListView`, `TicketDetailView`, `DashboardView` remain byte-for-byte unchanged.
- [ ] English and Arabic translations exist for every new string; RTL preserved.
- [ ] Unit/component tests exist and pass; existing tests remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
