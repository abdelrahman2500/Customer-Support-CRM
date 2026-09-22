> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/localize-agent-ticket-status-priority/localize-agent-ticket-status-and-priority/intake.md`

---

## Feature

- **Feature name (display):** Localize agent ticket status and priority
- **Feature slug (folder under `plans/`):** `localize-agent-ticket-status-priority`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `153`
- **Work item type:** story
- **Status:** planned
- **Labels:** i18n, agent-workspace, tickets

---

## Title

```
Localize agent ticket status and priority
```

---

## Description

```
The agent workspace renders TicketStatus and TicketPriority enum values raw.
An Arabic-speaking agent reads "IN_PROGRESS" and "URGENT" in Latin capitals on
the ticket list, ticket detail, dashboard, customer detail and the customer
context panel, while an Arabic customer reading the same ticket in the portal
sees "قيد المعالجة".

Verified at HEAD d03848a:

- apps/web/messages/en.json has NO `tickets.status` and NO `tickets.priority` key.
- apps/web/messages/ar.json likewise.
- 15 raw render sites across 7 files (list below).
- No status/priority label mapping exists anywhere in apps/web.

The portal already solved exactly this in Story 148: `tickets.status.*` exists
in both portal catalogs, `TicketListView` renders
`t(`status.${ticket.status}`)`, and `ticket-filter-messages.spec.ts` guards the
keys' existence, distinctness, Arabic script, and plural categories.

Bring the agent workspace to the same standard, using the portal implementation
as the reference.
```

---

## Acceptance criteria

```
- `tickets.status.*` (OPEN, IN_PROGRESS, RESOLVED, CLOSED) exist in apps/web/messages/en.json and ar.json.
- `tickets.priority.*` (LOW, MEDIUM, HIGH, URGENT) exist in both web catalogs.
- Arabic values are genuine Arabic script, not English copies.
- EN/AR key parity remains exact.
- All raw enum render sites in apps/web render a localized label instead.
- Badge variants are unchanged: ticketStatusBadgeVariant / ticketPriorityBadgeVariant keep mapping from the RAW enum value, never the label.
- The ticket-detail status/priority Select options show localized labels while their values stay the raw enum.
- No backend enum, DTO, API contract or query changes.
- A catalog guard spec asserts the keys exist, are distinct, are Arabic, and cover every enum member.
- web suite, typecheck, lint green.
```

---

## Verified render sites (HEAD d03848a)

| File | Lines |
|---|---|
| `apps/web/src/components/tickets/ticket-list-view.tsx` | 393, 397 |
| `apps/web/src/components/tickets/ticket-detail-view.tsx` | 319 (status Select), 346 (priority Select) |
| `apps/web/src/components/tickets/customer-context-panel.tsx` | 99, 101 |
| `apps/web/src/components/customers/customer-detail-view.tsx` | 621, 623 |
| `apps/web/src/components/dashboard/dashboard-view.tsx` | 151, 152, 362, 364 |
| `apps/web/src/components/dashboard/tasks-panel.tsx` | 141 |
| `apps/web/src/components/sla-policies/sla-policy-list-view.tsx` | 179 |

---

## Attachments

None.

## Dependencies

- **Reference implementation:** Story 148 (portal) — `apps/portal/messages/*.json` `tickets.status`, `apps/portal/src/components/tickets/ticket-list-view.tsx`, `apps/portal/src/test/ticket-filter-messages.spec.ts`.

## Extra notes

- `reports-view.tsx:271` builds a `${row.status}: ${row.count}` chart label from a reporting DTO, not a ticket entity. Treat separately; do not force it into this story if the report's own data shape makes it awkward.
- `sla-policy-list-view.tsx:179` renders a POLICY's priority (the policy's matching criterion), not a ticket's. It is the same enum and should use the same labels.
- `tasks-panel.tsx:141` renders a TASK priority. Verify the task priority enum matches TicketPriority before reusing the keys; if it differs, leave it out and say so.

## Out of scope

- The portal (already done in Story 148).
- Sharing badge logic between web and portal (F12 — needs a domain-package decision).
- Any backend enum or DTO change.
- Any change to Badge variants or colours.
