# Story 193 — i18n leak fixes

> CRM UI/UX redesign roadmap item **RD-1.16**. Intake: [`../../stories/i18n-leak-fixes/i18n-leak-fixes/intake.md`](../../stories/i18n-leak-fixes/i18n-leak-fixes/intake.md). Roadmap: [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) §6 "RD-1.16"; recon TK-01, TW-10, PT-04.

---

## Prerequisites

- **Story 191** (`4f96bad`, RD-1.14): the `@crm/shared` ticket presentation data, the web `TicketPriorityBadge`, and the portal `TicketStatusBadge`. The portal priority badge was deferred to this Story.
- No dependency on other RD items.

---

## Story Goal

Remove the raw enum text that agents and customers still read. Values sent to the API stay raw. Only the visible text changes.

**Non-goals:**
- audit-log code labels (RD-6.7)
- date formatting (RD-1.17)
- history detail (who changed what; RD-3.x)
- any backend, API or database change

---

## Design decisions

1. **Web filters.** The status and priority `FilterSelect`s get `renderLabel={ticketLabels.status}` / `renderLabel={ticketLabels.priority}`. This is the same pattern the category and agent filters already use. The `options` and `value` stay raw.
2. **History event labels.** next-intl resolves dots as nesting, so a key named literally `ticket.created` cannot be looked up. A local map translates event types to camelCase keys:
   - `ticket.created` → `created`
   - `ticket.updated` → `updated`
   - `ticket.recategorized` → `recategorized`
   - `ticket.escalated` → `escalated`
   - anything else → `other`, read as "Ticket changed" / "تم تغيير التذكرة" (distinct from "updated")

   This mirrors `EVENT_LABEL_KEY` in the web `notification-toaster.tsx`. The keys live in `tickets.detail.historyEvent.*` in both apps.
3. **Portal priority.**
   - Add `tickets.priority.{LOW,MEDIUM,HIGH,URGENT}` in en and ar, using the same words as the web `common.ticketPriority`.
   - Add `components/tickets/ticket-priority-badge.tsx` (`TicketPriorityBadge`) with the shared tone and icon, matching the portal `TicketStatusBadge`.
   - It renders in the detail page's priority `<dd>`.
4. **Portal toast.** `messageFor` receives the `tickets` translator and passes `status: tTickets("status.<VALUE>")`. An unknown status falls back to the raw value: next-intl's missing-key fallback, the same as the status badge.

---

## Context — Read These Files First

1. `apps/web/src/components/tickets/ticket-list-view.tsx` ~205–220; `apps/web/src/hooks/use-ticket-labels.ts`.
2. `apps/web/src/components/tickets/ticket-detail-view.tsx` ~803; `apps/portal/src/components/tickets/ticket-detail-view.tsx` ~135 and ~171.
3. `apps/portal/src/components/portal/notification-toaster.tsx` `messageFor`.
4. `apps/portal/src/components/tickets/ticket-status-badge.tsx` (the Story 191 pattern).
5. `apps/api/src/modules/tickets/ticket-history.listener.ts`: the four event types. Read-only reference.
6. Guards:
   - `apps/web/src/test/ticket-enum-messages.spec.ts`
   - `apps/portal/src/test/ticket-filter-messages.spec.ts`
   - `apps/portal/src/design-tokens.spec.ts`

---

## Tasks

1. **Web list:** add `const ticketLabels = useTicketLabels();` and the two `renderLabel`s.
2. **Web detail:** `historyEventLabel(entry.eventType)` via the key map and `t("detail.historyEvent.<key>")`.
3. **Portal detail:**
   - the same history mapping;
   - the priority `<dd>` renders `<TicketPriorityBadge priority={ticket.priority} />`.
4. **Portal:** create `ticket-priority-badge.tsx` (+ spec).
5. **Portal toaster:** localize the status.
6. **Messages:** web en/ar `tickets.detail.historyEvent.*`; portal en/ar `tickets.detail.historyEvent.*` and `tickets.priority.*`.
7. **Parity specs:**
   - web `ticket-enum-messages.spec.ts`: add every history event key in en and ar, non-empty and distinct;
   - portal `ticket-filter-messages.spec.ts`: add priorities and history event keys.

---

## Test Plan

- **Web `ticket-list-view.spec.tsx`:** the status filter's options read through labels. Use the spec's key-echo translator, e.g. `ticketStatus.IN_PROGRESS`, never a bare `IN_PROGRESS` as option text. Only if the spec can open the select cheaply; otherwise the parity spec plus the harness cover it.
- **Web and portal detail specs:** a history entry `ticket.escalated` renders its key or label, not the raw `ticket.escalated`; an unknown type renders the `other` key.
- **Portal `ticket-priority-badge.spec.tsx`:** 4 priorities × en/ar, with label, icon and tone.
- **Portal `notification-toaster.spec.tsx`:** the existing assertion `… status: RESOLVED.` changes to the localized label. This is an intentional contract change.
- **Parity specs:** as in task 7.

---

## Verification Steps

1. Web and portal tests, typecheck and lint.
2. Both builds.
3. Harness: the web ticket list with the status filter open in ar, and the web and portal ticket detail in ar. Check for no `[A-Z_]{4,}` enum text in the dropdown options, the history list or the priority field.
4. Run `git diff --check`, review the diff, and confirm `qa-review.md` and `stash@{0}` are untouched.

---

## Done Criteria

- [ ] Web status/priority filters show localized labels; their values are unchanged.
- [ ] History event labels in both apps, with the generic fallback.
- [ ] Portal priority is localized as a `TicketPriorityBadge`.
- [ ] The portal toast status is localized.
- [ ] The parity specs cover every value in both locales.
- [ ] Tests, typecheck, lint and builds pass; no backend change.
