# RM-02 — Customer Notes

**Priority:** P2 · **Complexity:** Small · **Blocked:** No · **Phase:** 1 (Agent Experience)

## Goal

Let an agent attach a free-text, internal-only note to a `Customer` record,
mirroring the existing `TicketNote` pattern exactly.

## Why it exists

Core 1 (Customer Management) names "Notes and attachments" explicitly.
`CustomerAttachment` exists; a customer-level note does not — only
`TicketNote` exists today, and it is ticket-scoped. Confirmed absent by a
full read of `schema.prisma`'s customers schema section and of
`customer-detail-view.tsx`.

## Dependencies

None — a direct pattern-copy of `TicketNote`/its controller/service/UI.

## Backend work

- New `CustomerNote` model: `id`, `customerId` (FK, cascade), `authorUserId`,
  `body`, `createdAt` — same shape as `TicketNote`, branch-scoped implicitly
  via the parent `Customer`.
- `POST /customers/:id/notes` (create), `GET /customers/:id/notes` (list,
  paginated like every other list this session's `bounded-list-caps`/
  `ticket-list-cap` precedent established), gated by the existing
  `customer:update`/`customer:read` permissions (no new permission key,
  mirroring `TicketNote`'s own reuse of `ticket:update`/`ticket:read`).
- Append-only — no edit/delete endpoint, matching `TicketNote`'s own
  convention exactly.

## Frontend work

- A "Notes" card in `CustomerDetailView`, reusing the existing
  ticket-notes UI pattern (`AddNoteForm`-equivalent + a chronological list).

## Worker/realtime work

None — `TicketNote` itself has no realtime event beyond the generic
`ticket.note-added` relay; a customer-level note does not need one either
(no equivalent "customer workspace" screen with a live-updating note feed to
justify it).

## Schema/migration work

One new table (`CustomerNote`), one migration, one FK to `Customer` with
cascade delete.

## Tests

- `customers.service.spec.ts` — extend with create/list cases.
- `customers.e2e-spec.ts` — extend with an authenticated round-trip test and
  a 403 test for a caller lacking `customer:update`.
- `customer-detail-view.spec.tsx` — extend for the new Notes card
  (loading/empty/populated states).

## Acceptance criteria

- An agent with `customer:update` can add a note to a customer; any agent
  with `customer:read` can read the note list.
- Notes are never exposed to the Customer Portal (no portal endpoint reads
  this table) — matching `TicketNote`'s own internal-only guarantee.
- Notes are branch-scoped transitively through the parent customer (no
  direct `branchId` needed on the note itself, matching `TicketNote`).

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/web test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
