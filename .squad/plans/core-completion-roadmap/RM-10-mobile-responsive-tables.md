# RM-10 — Mobile-Responsive Data Tables

**Priority:** P1 · **Complexity:** Medium · **Blocked:** No · **Phase:** 3 (Platform / Mobile)

## Goal

Give the three busiest list screens (ticket list, customer list, user list)
a genuine narrow-viewport layout, not just the existing horizontal-scroll
safety net.

## Why it exists

`packages/ui/src/components/table.tsx` already wraps every table in an
`overflow-x:auto` container by construction — nothing breaks outright on a
small screen. But `ticket-list-view.tsx`, `customer-list-view.tsx`, and
`user-list-view.tsx` have zero responsive breakpoint classes of their own;
at real mobile widths (375–428px) they render as a tiny, horizontally-
scrolling table, not a usable mobile list. Only ~11% of web component files
use any breakpoint at all.

## Dependencies

None. Reuses and extends `@crm/ui`'s existing `Table` primitive — does not
replace it or introduce a second UI system.

## Backend work

None.

## Frontend work

- Add a responsive variant to `packages/ui`'s `Table` component: below a
  chosen breakpoint, render each row as a stacked card (label/value pairs)
  instead of a `<tr>`, reusing the exact same column definitions callers
  already pass in (no per-screen bespoke card markup — the primitive does
  the transform once, consistently).
- Apply it to `ticket-list-view.tsx`, `customer-list-view.tsx`,
  `user-list-view.tsx` — no bespoke per-screen layout code, just adopting
  the extended primitive.
- Filter/search controls on these three screens (already present) get a
  matching narrow-viewport layout pass (stacked instead of inline) as part
  of the same primitive/pattern work, since they sit directly above each
  table.

## Worker/realtime work

None.

## Schema/migration work

None.

## Tests

- `packages/ui` — new component test for the `Table` primitive's
  card-fallback mode at a narrow viewport (using the project's existing
  responsive-testing approach, e.g. a matchMedia mock or viewport-driven
  test utility already in use elsewhere in this codebase).
- `ticket-list-view.spec.tsx` / `customer-list-view.spec.tsx` /
  `user-list-view.spec.tsx` — extend to assert the card fallback renders
  correctly for each screen's specific columns.

## Acceptance criteria

- All three list screens are genuinely usable — readable, tappable, no
  horizontal scrolling required to see a row's key fields — at common
  mobile viewport widths (375–428px).
- Desktop-width behavior is visually unchanged.

## Definition of Done

- All acceptance criteria verified visually (not just non-broken).
- `pnpm --filter @crm/ui test`, `pnpm --filter @crm/web test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
