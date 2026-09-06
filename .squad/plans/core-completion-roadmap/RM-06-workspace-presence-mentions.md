# RM-06 — Workspace Presence + @Mentions

**Priority:** P1 · **Complexity:** Medium-Large · **Blocked:** No · **Phase:** 1 (Agent Experience)

## Goal

Extend Story 108's presence foundation into the ticket workspace itself
(assignee picker), and let an agent @mention a teammate in an internal
ticket note, generating a targeted notification.

## Why it exists

Story 108 (`agent-presence-ui`) deliberately, explicitly scoped the presence
indicator to the Users admin list — its own plan states this was "the
natural, minimal integration point," not a final judgment that presence
never belongs in the ticket workspace. Today, an agent deciding who to
hand a ticket off to (the assignee picker in `TicketDetailView`) has no
visibility into who is actually online. Separately, @mentions do not exist
anywhere in the codebase — an agent cannot flag a specific teammate on a
ticket note; the whole team must notice a plain note themselves.

## Dependencies

`PresenceService`/`RealtimeGateway`'s `agent:{id}:presence` room and the
`useAgentPresence` hook (Story 108/71) — both already fully built; this
story only adds a new consumer, no new presence-tracking mechanism.

## Backend work

- Extend `TicketNote` creation to parse `@username`/`@fullName` mentions in
  the note body (a simple, bounded parser — not a rich-text editor), resolve
  each to a `User` in the same branch, and for each resolved mention emit a
  targeted notification (reuse `NotificationLog` + the existing
  `BranchNotificationRealtimeListener`-shaped relay, scoped to the mentioned
  user rather than the whole branch — same pattern `RM-03`'s reminder
  delivery introduces, reuse whichever per-agent room shape that story
  settles on rather than inventing a second one).
- No change needed to `PresenceService`/`RealtimeGateway` — the frontend is
  the only new consumer.

## Frontend work

- Wire the existing `useAgentPresence` hook into `TicketDetailView`'s
  assignee `Select` (an online/offline dot per option, mirroring
  `UserListView`'s existing presence rendering).
- A basic @mention affordance in the ticket-note composer (a simple
  dropdown triggered by typing `@`, listing branch agents by name) — not a
  full rich-text mentions UI; parity with the backend's bounded parser.

## Worker/realtime work

None new beyond the targeted-notification relay described above (reuses
existing infrastructure end-to-end).

## Schema/migration work

None, unless the targeted-notification path requires a new
`recipientUserId` column on an existing notification-adjacent table —
confirm against `NotificationLog`'s current shape during implementation;
likely already supports a single-recipient row (portal notifications already
use a comparable `customerId`-scoped shape).

## Tests

- `ticket-notes` service spec — extend for @mention parsing and resolution
  (including an unresolvable/unknown mention, which should be silently
  ignored, not an error).
- New e2e coverage: mentioning a teammate produces exactly one notification
  for that teammate, none for anyone else.
- `ticket-detail-view.spec.tsx` — extend for the presence-dot assignee
  picker and the mention-dropdown composer.

## Acceptance criteria

- The ticket assignee picker shows live online/offline state per agent.
- An `@mention` in a note reliably notifies the mentioned agent, both
  in-app (`NotificationLog`) and realtime, and notifies no one else.
- An unresolvable mention (typo, agent outside the branch) is silently
  ignored — never an error that blocks saving the note.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/web test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
