# RM-11 — Mobile-Responsive Navigation

**Priority:** P1 · **Complexity:** Small-Medium · **Blocked:** No · **Phase:** 3 (Platform / Mobile)

## Goal

Give the agent workspace's primary navigation (`WorkspaceNav`) and the
portal's header (`PortalHeader`) a real collapsed/mobile pattern.

## Why it exists

`WorkspaceNav` today uses `flex flex-wrap` (wraps to new lines on narrow
screens) but has no hamburger/collapsed menu and no responsive breakpoint
classes of its own — at real mobile widths it becomes a tall, multi-row
wall of nav links above the page content. `PortalHeader` already received
one targeted mobile fix (Story 96, `flex-wrap` to stop viewport overflow)
but likewise has no genuine collapsed pattern.

## Dependencies

Sequenced after `RM-10` — a usable mobile nav matters most once the screens
it links to are themselves mobile-usable.

## Backend work

None.

## Frontend work

- `WorkspaceNav`: below a breakpoint, collapse the ~19-item flat nav list
  behind a menu toggle (a slide-over or dropdown, reusing whatever overlay
  primitive `packages/ui` already provides — e.g. the same one dialogs use,
  per this codebase's existing RTL-aware overlay work) rather than
  wrapping every item onto the header itself.
- `PortalHeader`: same collapsed-menu pattern for its (much shorter) nav.
- Preserve RTL correctness for the new collapsed menu (mirrors the existing
  RTL-aware dialog-centering precedent already established elsewhere in
  `packages/ui`).

## Worker/realtime work

None.

## Schema/migration work

None.

## Tests

- `workspace-nav.spec.tsx` / `portal-header.spec.tsx` (or equivalent) —
  extend to assert the collapsed menu appears below the breakpoint and
  every existing nav item remains reachable through it.

## Acceptance criteria

- At mobile viewport widths, the primary nav in both apps is a compact,
  tappable collapsed menu, not a wall of wrapped links pushing content
  down.
- Every nav item remains reachable and correctly RTL-mirrored in Arabic.

## Definition of Done

- All acceptance criteria verified visually.
- `pnpm --filter @crm/web test`, `pnpm --filter @crm/portal test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
