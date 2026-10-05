# Story 201 — Ticket header: identity and state

> CRM UI/UX redesign roadmap item **RD-3.1**. Intake: [`../../stories/ticket-header-identity-and-state/ticket-header-identity-and-state/intake.md`](../../stories/ticket-header-identity-and-state/ticket-header-identity-and-state/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) Phase 3, its shared constraints, and "RD-3.1"; recon TW-01 (Critical), TW-09.

---

## Prerequisites

- **Phase 2** complete (Stories 195–200).
- **Story 191** `TicketStatusBadge`/`TicketPriorityBadge`; **Story 192** `SlaIndicator`; **Story 189** `Avatar`, `DescriptionItem`, `BackLink`; **Story 194** `formatDateTime`.
- **Phase 3 shared constraints:**
  - no API change;
  - every section, action and mutation stays;
  - a section-survival guard spec starts here;
  - the two ticket Playwright specs must pass;
  - selectors change only with a recorded reason;
  - assertions are never weakened.

---

## Story Goal

A ticket header that says what the ticket is and what state it's in, at a glance and without scrolling (TW-01). It replaces today's header block (back link, subject, "Customer:" line) with a `TicketHeader` component:

- **Identity:**
  - `BackLink` to the list;
  - the short id (`#` plus the first 8 characters, as on the list);
  - the subject `h1`, with the inline edit moved verbatim.
- **State:** a wrapping `<dl>` of facts:
  - Status (badge)
  - Priority (badge)
  - SLA (`SlaIndicator`, compact)
  - Assigned agent (avatar plus name, or "Unassigned")
  - Customer (a link)
  - Created and Updated (`formatDateTime`, in `<time dateTime>`)
- **Sticky at `lg`:** `lg:sticky lg:top-0 lg:z-20` on the canvas background, so state stays visible while the agent works down the page.

It also adds the **section-survival guard**: every section and control that exists today is asserted present.

**Non-goals:**
- header actions (Assign to me, Resolve/Close; RD-3.2)
- inspector restructure (RD-3.3)
- the **channel** fact: `Ticket` has no channel field in the schema or API. It is deferred and documented, with no backend change.
- relative times; a live SLA countdown

---

## Design decisions

1. **Ownership.**
   - `TicketHeader` owns the subject-edit UI state: `editingSubject`, `subjectDraft`, the two focus refs and the focus-restore effect. These are moved *verbatim* from `TicketDetailView`, Story 156/166 comments included.
   - The commit goes through a prop, `onSubjectCommit(value, { onError })`, which the view wires to the same `mutation.mutate({ subject }, { onError })`.
   - The revert-on-error behaviour is kept: the header passes `onError: () => setSubjectDraft(ticket.subject)`.
2. **Facts.**
   - Each fact is a `DescriptionItem` (dt caption plus dd value) inside `<dl className="flex flex-wrap gap-x-section gap-y-stack">`.
   - The terms reuse `tickets.list.columns.*` and `list.unassigned`, so no new copy.
   - **No `aria-label` and no `<label>`** are added anywhere in the header, so Playwright's substring `getByLabel("Status")` still resolves only to the inspector `Select`.
3. **SLA fact:**
   - while the SLA query is loading: a small `Skeleton` inside the dd;
   - on success: the compact `SlaIndicator` (createdAt passed, so the D3 at-risk tier works);
   - on error: the dd shows "—". The side card keeps owning the error and the hold/resume actions.
4. **Assignee fact:**
   - `Avatar size="sm" decorative` plus the name (`truncate max-w-48`). The presence dot comes from `useAgentPresence`, already in scope in the view and passed down; its text equivalent is RD-3.4.
   - With no assignee: `text-ink-subtle` "Unassigned".
5. **Sticky:**
   - `lg:sticky lg:top-0 lg:z-20 bg-surface-sunk`, plus `pb-stack` and `border-b border-rule-subtle`, so stuck content doesn't bleed through.
   - Below `lg` it scrolls normally, which keeps phones simple (mobile workspace is RD-3.12).
6. **The `h1` is unchanged.** The subject is the single `h1` in both modes, with the same `sr-only` `h1` while editing.

---

## Context — Read These Files First

1. `apps/web/src/components/tickets/ticket-detail-view.tsx` ~209–379 (hooks, the subject edit, the header block) and ~484–746 (the inspector card and the SLA card).
2. `apps/web/src/components/tickets/ticket-detail-view.spec.tsx` ~319–456 (header and layout cases) and ~458–657 (subject edit and focus restoration).
3. `apps/web/src/components/tickets/{ticket-badges,sla-indicator}.tsx`; `packages/ui/src/components/{avatar,description-list,back-link}.tsx`.
4. `apps/e2e/tests/agent-resolves-ticket.spec.ts` (`getByLabel("Status")`), `agent-customer-live-chat.spec.ts`.

---

## Tasks

1. **Create `apps/web/src/components/tickets/ticket-header.tsx`.** Its props: `ticket`, `locale`, `slaTargetQuery`-derived `{ status: "loading" | "error" | "ready", target }`, `assigneeName`, `assigneePresence`, and `onSubjectCommit`.
2. **`ticket-detail-view.tsx`:**
   - replace the header block with `<TicketHeader … />`;
   - remove the moved state, refs and effect;
   - keep `mutation` wiring and the error `Alert` below the header unchanged.
3. **Create `ticket-header.spec.tsx`.** It covers:
   - the facts and their terms;
   - the short id;
   - unassigned;
   - SLA loading, error and ready;
   - the customer link `href`;
   - `<time dateTime>`;
   - sticky classes;
   - no physical classes;
   - no element with an `aria-label` containing "Status"/"Priority".
4. **`ticket-detail-view.spec.tsx`:**
   - a new **"section survival (Phase 3 guard)"** describe asserting every section heading (chat, notes, attachments, KB references, customer context, SLA, escalations, history, CSAT) and every control (subject edit, status, priority, category, assignee and department selects, hold/resume, note composer, attachment upload) present;
   - the header facts appear before the conversation in DOM order.

   Existing subject and focus specs stay as they are and must pass.

---

## Verification Steps

1. Web tests, typecheck and lint; prettier only on changed files that were clean at HEAD.
2. Web build; Playwright `agent-resolves-ticket` and `agent-customer-live-chat`.
3. Harness at 320, 768 and 1280 × en/ar × light/dark on a seeded ticket:
   - 0 overflow;
   - at 1280 the status, priority, SLA and assignee dd's are inside the first viewport;
   - after scrolling 1500px at 1280 the header is still at `top=0` (sticky);
   - keyboard: Tab reaches the Edit button, Enter opens the input, Escape restores focus.
4. Run `git diff --check`; check the protected checksum; commit path-scoped.

---

## Done Criteria

- [ ] `TicketHeader` with identity and state facts; the subject edit is verbatim.
- [ ] State is visible without scrolling at 1280, and the header is sticky at `lg`.
- [ ] Single `h1`; no new Status/Priority labels.
- [ ] Section-survival guard plus header spec; existing specs untouched and green.
- [ ] Web tests, typecheck, lint, build and the two Playwright specs pass; harness 0 overflow.
- [ ] Channel deferred (no data); no backend change.
