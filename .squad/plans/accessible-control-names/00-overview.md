# accessible-control-names — plan overview

Entry point for the **accessible-control-names** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 164 | [164-story-accessible-control-names-and-portal-status-localization.md](./164-story-accessible-control-names-and-portal-status-localization.md) | Accessible control names and final portal ticket-status localization | 164 | Story 150 (`TableCell` `label`), Story 153 (ticket label hooks) |

## Dependency notes

Two independent findings from the recon at `8e8a58c`, both concrete and both
mechanical, shipped together because each is a handful of lines and both are
"the string already exists, it just is not reaching the user".

### Why the table cases survived six accessibility stories

Story 150 gave `TableCell` a `label` prop for the responsive table: below `sm`
it renders a visible span standing in for the `<th>` that is hidden there. At
`sm` and up that span is `display:none`, so it contributes nothing to the
accessibility tree — and a column header does not name a form control nested
inside the column anyway.

The result is a convention that *looks* like labelling. Six inline-edit inputs
sat inside cells carrying a `label`, and were announced as "edit text" plus
their current value. Nothing was missing at a glance, which is exactly why a
guard is worth more here than the fix.

### Why `aria-label` rather than `FormField`

`FormField` renders a visible `<label>` element. Adding one inside a table cell
would change the column's layout on every row — a visual redesign bought to fix
a semantics bug. `aria-label` changes the accessibility tree and nothing else,
and each site already has the right string: the very key its own
`TableCell label=` is passed.

### The portal enum

One screen missed a convention the app already had. `ticket-filter-messages`
did not catch it because that guard asserts the message keys *exist*, not that
a component uses them — so the new guard matches an enum rendered as a JSX
**child**, the only position that becomes visible text, and therefore never
touches the legitimate `variant={ticketStatusBadgeVariant(ticket.status)}`
sitting on the very same element.
