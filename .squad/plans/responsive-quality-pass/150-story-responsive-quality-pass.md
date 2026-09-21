# Story 150 — Responsive quality pass

## Prerequisites

- RM-10 — `Table`/`TableCell`'s dual desktop-table / mobile-card layout and the `label` prop.

## Goal

Fix the concrete responsive defects that materially affect usability at
real viewport widths. In practice, after measuring, that is one thing:
finish adopting `TableCell`'s `label` prop so every data table stays
readable below `sm`.

## The measured defect

`Table` renders a real `<table>` at `sm` and up. Below `sm` it renders each
row as a stacked card, and `TableHeader` is `hidden` — so the only thing
that says what a value means is `TableCell`'s `label`.

Measured across both apps:

| | count |
|---|---|
| `<TableCell>` call sites | 93 |
| ...carrying `label` | 17 |
| table-bearing files | 17 |
| ...that adopted `label` | 3 |

RM-10 converted `ticket-list-view`, `customer-list-view` and
`user-list-view` and stopped. Every other table renders below `sm` as an
anonymous stack of bare values. Concretely:

- **My sessions** shows two `toLocaleString` dates one above the other with
  nothing saying which is "last active" and which is "signed in since".
- **Audit log** shows eight unlabelled lines per entry.
- **SLA policies** shows two bare durations — response vs resolution target,
  indistinguishable.
- **Automation rules** shows five consecutive "—"/value lines for its five
  action columns.

This is not a missing-breakpoint metric. It is a shipped mechanism at 18%
adoption, and the result is unreadable on a phone.

## Non-goals — candidates investigated and rejected on evidence

Each of these was checked against the actual source before being dropped.
None is a real defect today:

- **Adding breakpoints to the ~38 components that have none.** "No
  breakpoint" is not a defect; most of those components are already fluid.
- **Filter rows.** Every `min-w-[10rem]` filter select sits in a
  `flex flex-wrap` (or `FilterBar`) container, so they wrap rather than
  overflow. 160px fits a 320px viewport.
- **Non-responsive grids.** A repo-wide scan for `grid-cols-[2-9]` without
  a breakpoint prefix returns **zero** hits.
- **`whitespace-nowrap` overflow.** Zero hits in either app.
- **Dialog width at 320px.** Already fixed by Batch 8 —
  `w-[calc(100%-2rem)]` guarantees a 1rem gutter.
- **Dialog vertical overflow.** `DialogContent` has no `max-h`/scroll, but a
  repo-wide scan finds **zero** `<DialogContent>` call sites — only short
  `ConfirmDialog`s (title, description, two buttons) are in use. Fixing an
  overflow no one can currently reach would be speculative.
- **Long unbreakable strings in cells.** The three `font-mono` cells hold a
  truncated key prefix, an IP address, and a URL that already carries
  `max-w-xs truncate`. None overflows.
- **Charts.** Story 146 already added `min-w-0 break-words` to `BarChart`'s
  row label for exactly this reason, with a measured 390px case.

## Design

Purely additive: add `label={...}` to each data `TableCell`, reusing the
**same i18n key its own `<TableHead>` already renders**, so the mobile label
and the desktop header can never disagree or drift.

Rules applied per cell:

- A cell whose column has a visible header gets that header's key.
- A trailing **actions** cell (buttons only) gets **no** label — the
  primitive's own doc says to omit it for a cell needing no label, and
  "ACTIONS: [Delete]" is noise.
- A `colSpan` expansion row (webhook delivery attempts, role permissions)
  gets no label — it is a detail panel, not a column.

No new component, no new primitive, no new breakpoint, no desktop change.
At `sm` and up the `label` span is `sm:hidden`, so **every desktop layout is
byte-identical**.

Also fixes one regression introduced by Story 149: the translation-status
cell added to `article-list-view` shipped without a `label`.

## Files expected to change

`apps/web`: `audit-logs/audit-log-view`, `sla-policies/sla-policy-list-view`,
`automation-rules/automation-rules-view`,
`notifications/notification-history-view`,
`knowledge-base/article-list-view`, `knowledge-base/article-detail-view`,
`api-keys/api-keys-view`, `ticket-categories/ticket-categories-view`,
`settings/my-sessions-view`, `roles/role-list-view`,
`kb-categories/kb-categories-view`, `branches/branch-departments-view`,
`quick-replies/quick-replies-view`,
`webhook-subscriptions/webhook-subscriptions-view`,
`tickets/ticket-list-view` (one missed cell).

`apps/portal`: `portal/notification-history-view`.

Plus a shared guard spec asserting the adoption does not regress.

## Acceptance criteria

- [ ] Every data `TableCell` in both apps carries a `label` matching its own column header.
- [ ] Action-only and `colSpan` cells deliberately carry none.
- [ ] Labels come from the same i18n key as the header, never a second string.
- [ ] Desktop (`sm`+) rendering is unchanged everywhere.
- [ ] A guard test fails if a future data cell ships without a label.
- [ ] No token/RTL guard regresses; no physical-direction utility added.
- [ ] No behaviour, routing, auth, or API change.

## Verification plan

- `apps/web` + `apps/portal` unit suites (including the design-token/RTL guards).
- The new adoption guard spec.
- Relevant e2e (unchanged behaviour must stay unchanged).
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Final `git diff` audit.
