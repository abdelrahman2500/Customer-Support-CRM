> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/i18n-leak-fixes/i18n-leak-fixes/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** i18n leak fixes
- **Feature slug (folder under `plans/`):** `i18n-leak-fixes`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** `` *(none — `--no-tracker`; CRM UI/UX redesign roadmap item **RD-1.16**, global Story **193**)*
- **Work item type:** `Story`
- **Status:** `Ready for planning`
- **Assignee:** ``
- **Labels:** `crm-ui-ux-redesign`, `phase-1-design-foundation`, `i18n`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```
i18n leak fixes
```

---

## Description

```
Story 193 — RD-1.16 "i18n leak fixes" of the CRM UI/UX redesign track
(roadmap: .squad/plans/crm-ui-ux-redesign/00-overview.md §6 "RD-1.16";
recon TK-01, TW-10, PT-04).

GOAL
No raw enum text visible to agents or customers, in either locale, at the
places the roadmap names.

CONTEXT (verified at HEAD 6138ef9)
- Web ticket list status/priority FilterSelects (ticket-list-view.tsx
  ~205–220) pass raw enum options with no renderLabel, so the dropdown shows
  "IN_PROGRESS"/"URGENT" (TK-01). useTicketLabels (common.ticketStatus/
  ticketPriority) already has the labels.
- Ticket history renders entry.eventType raw: web ticket-detail-view.tsx
  ~803, portal ticket-detail-view.tsx ~171. The API writes four types
  (ticket-history.listener.ts): ticket.created, ticket.updated,
  ticket.recategorized, ticket.escalated (TicketHistoryEntry.eventType is a
  free string, so unknown values must fall back to a generic label).
- Portal ticket detail renders {ticket.priority} raw (~135); the portal has
  no priority labels (Story 191 deferred its priority badge here).
- Portal notification toaster interpolates payload.ticket.status raw into
  "… — status: RESOLVED." (notification-toaster.tsx messageFor).
- Guards: web test/ticket-enum-messages.spec.ts; portal
  test/ticket-filter-messages.spec.ts; portal design-tokens.spec raw-enum
  child guard.

REQUIRED OUTCOME
1. Web status/priority FilterSelects render localized labels (values stay
   the raw enum sent to the API).
2. History event labels in both apps via a camelCase key map (next-intl
   treats dots as nesting), generic fallback for unknown types.
3. Portal priority: tickets.priority.* labels (en/ar) and a portal
   TicketPriorityBadge (shared tone/icon from @crm/shared, as the web).
4. Portal toast status localized through tickets.status.*.
5. Parity specs extended to every enum/event value in both locales.
```

---

## Acceptance criteria

```
- [ ] No raw enum text in the web status/priority filters, either history
      list, the portal priority, or the portal toast — en and ar (specs).
- [ ] Unknown history event types render a generic localized label.
- [ ] Parity specs cover every status, priority and history event value in
      both locales for both apps.
- [ ] Web and portal tests, typecheck, lint, builds pass.
- [ ] No backend/API/database change; filter values unchanged.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** none. Roadmap: RD-1.16 has no dependencies.
- **Depends on code areas or other stories:** Story 191 (shared ticket presentation, web badges, portal status badge).

## Extra notes (optional)

- Audit-log code labels are RD-6.7 (out of scope).

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Files: web `ticket-list-view.tsx`, `ticket-detail-view.tsx`, `messages/{en,ar}.json`, `test/ticket-enum-messages.spec.ts`; portal `ticket-detail-view.tsx`, `notification-toaster.tsx`, new `ticket-priority-badge.tsx`, `messages/{en,ar}.json`, `test/ticket-filter-messages.spec.ts`.

## Out of scope

- Audit-log labels (RD-6.7), the dates (RD-1.17), any backend/API/database change.
