# Story 202 — Ticket header actions

> CRM UI/UX redesign roadmap item **RD-3.2**. Intake: [`../../stories/ticket-header-actions/ticket-header-actions/intake.md`](../../stories/ticket-header-actions/ticket-header-actions/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 3 "RD-3.2"; recon TW-01, TW-08.

---

## Prerequisites

- **Story 201** (`1d8f30c`, RD-3.1): `TicketHeader` and the Phase 3 section-survival guard.
- The existing `useUpdateTicketMutation` (the single ticket `PATCH`), `useCurrentUserQuery`, `showSuccessToast` and the view's shared error `Alert`.
- The backend allows every status transition (`ticket-status-transitions.ts`).

---

## Story Goal

Put the two most frequent ticket actions in the header: **take the ticket** and **resolve it** (or close or reopen it). They go through *exactly* the request, toast and error handling of the equivalent inspector field.

**Non-goals:**
- prev/next (RD-3.14)
- new statuses or transitions
- unassign (RD-3.4)
- any API change

---

## Design decisions

1. **One code path.** `TicketDetailView` gains:
   - `updateStatus(value: TicketStatus)`, which is today's status `onValueChange` body: `mutation.mutate({ status }, { onSuccess: toast detail.statusUpdateSuccess })`;
   - `updateAssignee(id: string)`, which is today's assignee `onValueChange` body, with the same toast.

   The inspector `Select`s call these instead of their inline bodies, so the header buttons cannot drift from the fields.
2. **Actions.** `TicketHeader` gets `actions?: ReactNode`, rendered at the end of the title row: `flex flex-wrap items-start justify-between gap-inline`, so on narrow screens the actions wrap under the title. The view passes `<TicketHeaderActions>` (a small component in `ticket-header.tsx`) with:
   - `canAssignToMe`: the current user is known and isn't already the assignee;
   - `status`;
   - `pending`;
   - `onAssignToMe`, `onSetStatus`.
3. **The status quick action:**

   | Status | Actions |
   |---|---|
   | OPEN or IN_PROGRESS | **Resolve** (→ RESOLVED, primary `Button`) |
   | RESOLVED | **Close** (→ CLOSED, outline) and **Reopen** (→ OPEN, outline) |
   | CLOSED | **Reopen** (→ OPEN, outline) |

   "Assign to me" is an outline button with `size="sm"`; all actions are `sm`.
4. **States:**
   - every action is `disabled` while `mutation.isPending`, as the inspector fields are;
   - the accessible names are the visible text;
   - the actions wrapper is `role="group"` named by `detail.actions.label` ("Ticket actions"). It contains no "Status"/"Priority", so the Playwright `getByLabel("Status")` stays unique.
5. **Messages (en/ar):**
   - `detail.actions.label`: "Ticket actions" / "إجراءات التذكرة"
   - `assignToMe`: "Assign to me" / "إسناد إليّ"
   - `resolve`: "Resolve" / "حل"
   - `close`: "Close" / "إغلاق"
   - `reopen`: "Reopen" / "إعادة فتح"

---

## Context — Read These Files First

1. `apps/web/src/components/tickets/ticket-detail-view.tsx`: the `TicketHeader` usage, the status `Select` (~420), the assignee `Select` (~530) and the `mutation` error `Alert`.
2. `apps/web/src/components/tickets/ticket-header.tsx` (+ spec).
3. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx`: the status-toast cases (~780–860), the section-survival guard, and `useCurrentUserQuery` mocked as `agent-1`.

---

## Tasks

1. **Messages.**
2. **`ticket-header.tsx`:** the `actions` slot and `TicketHeaderActions`.
3. **`ticket-detail-view.tsx`:**
   - `updateStatus`/`updateAssignee`, with the `Select`s rewired to them;
   - `useCurrentUserQuery()`;
   - pass the actions.
4. **Specs:**
   - **Header spec:** the action set per status; Assign to me hidden when `canAssignToMe` is false; all disabled while pending; group name.
   - **Detail spec:**
     - Resolve sends `{ status: "RESOLVED" }` and toasts `detail.statusUpdateSuccess` with the localized label, the *same* call shape as the `Select` case;
     - Reopen on a resolved ticket sends `{ status: "OPEN" }`;
     - Assign to me sends `{ assignedToUserId: "agent-1" }` and toasts `detail.assignedAgentUpdateSuccess`;
     - the button is hidden when the ticket is already assigned to `agent-1`;
     - disabled while `isPending`;
     - the guard gains "Ticket actions".
   - The existing `Select` toast cases stay and must pass, which proves the shared handlers behave identically.

---

## Verification Steps

1. Web tests, typecheck and lint; prettier only on changed files that were clean at HEAD.
2. Web build; Playwright `agent-resolves-ticket` and `agent-customer-live-chat`.
3. Harness at 320, 768 and 1280 × en/ar × light/dark:
   - the actions are visible, with 0 overflow and focus rings;
   - the group name is correct.

   Mutations are not clicked in the harness (they would change seeded data); they are covered by the specs and by Playwright's resolve flow through the inspector.
4. Run `git diff --check`; check the protected checksum; commit path-scoped.

---

## Done Criteria

- [ ] Shared `updateStatus`/`updateAssignee`; the inspector and the header use them.
- [ ] Assign to me and the status quick action, disabled while pending, with text names.
- [ ] Specs assert the payloads and toasts; guard extended; Playwright green.
- [ ] 0 overflow at every width; no API change.
