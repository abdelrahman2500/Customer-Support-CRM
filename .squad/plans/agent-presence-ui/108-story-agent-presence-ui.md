# Story 108 — Agent Workspace: Agent Presence UI

## Goal

Give Story 71's backend agent-presence infrastructure (`PresenceService`,
`RealtimeGateway`'s `agent:{id}:presence` room/`agent.presence.changed`
event — fully built, tested, and until now entirely unconsumed) a real
frontend consumer: an online/offline indicator on the Agent Workspace's
Users list.

## Non-goals

- No change to `apps/api`'s realtime module — `PresenceService`/
  `RealtimeGateway`/`authorizeRoom` are already complete and correct for
  this story's needs (own id, or same-branch membership). Purely a
  frontend consumer.
- No presence indicator anywhere else in the Agent Workspace (ticket
  assignment dropdowns, a dedicated "team" page, etc.) — the Users admin
  list is the one existing surface that already lists every agent in the
  branch; adding presence elsewhere is a separate, later scope decision.
- No "last seen" timestamp or richer presence states (away/busy) —
  `PresenceService`/the `agent.presence.changed` event only ever carry a
  boolean `"online" | "offline"`; this story surfaces exactly that,
  nothing more.
- No change to `use-ticket-realtime.ts`'s or `use-branch-notifications.ts`'s
  own scope — both explicitly still don't touch `agent:{id}:presence`,
  unchanged.

## Design

- `useAgentPresence(userIds: string[]): Record<string, "online" | "offline">`
  (new hook, `apps/web/src/hooks/use-agent-presence.ts`): mirrors
  `useBranchNotifications`'s "one hook, one socket, joined on connect"
  shape (Story 24), generalized from one fixed room to a list of rooms.
  On `connect` (including Socket.IO's own automatic reconnects), joins
  `agent:{id}:presence` for every id in `userIds`; the backend's own
  `sendCurrentPresenceIfApplicable` immediately replies with the current
  status on each join, so the returned map is populated right after
  connecting, not left empty until a future transition happens to occur.
  `userIds` is a plain effect dependency (same as `useBranchNotifications`'s
  own `branchId`) — the caller must pass a referentially stable array.
- `UserListView`/`UserRow` (`apps/web/src/components/users/user-list-view.tsx`):
  `userIds` is memoized off `usersQuery.data` (already referentially
  stable across refetches via TanStack Query's default structural
  sharing) via `useMemo`, so the hook's socket effect doesn't tear down
  and reconnect on every unrelated re-render. A new "Presence" column
  renders a `Badge` (`success`/`secondary`, mirroring the existing
  `isActive` status Badge's own visual convention) reading "Online"/
  "Offline". A user not yet reported by the socket (still connecting, or
  the connection failed) renders as Offline — the same "unknown reads as
  the safe default" choice the existing `isActive` Badge would make if
  presence had a genuine third state, which it doesn't.
- i18n: `users.list.columns.presence`, `users.list.online`,
  `users.list.offline` added to both `messages/en.json` and
  `messages/ar.json`.

## Acceptance criteria

- [ ] `useAgentPresence` joins `agent:{id}:presence` for every given user
      id on connect; updates its returned map on `agent.presence.changed`;
      tolerates an empty `userIds` array or a missing access token by not
      connecting at all; tears down and reconnects when `userIds` changes;
      disconnects and removes listeners on unmount.
- [ ] `UserListView` renders a new "Presence" column showing each listed
      user's live status, defaulting to Offline before any event arrives.
- [ ] No backend files changed.
- [ ] Unit coverage: `useAgentPresence` (connect/join/event-handling/
      cleanup/reconnect-on-id-change, mirroring `use-branch-notifications.spec.ts`'s
      own test shape) and `UserListView` (presence column renders/updates,
      independent per row).
- [ ] Full verification cycle green for `apps/web` (no backend changes,
      so the API/worker e2e sweep is not re-run for this story — see
      CLAUDE.md §5's "as relevant to what changed").

## Verification plan

```
pnpm --filter @crm/web exec vitest run src/hooks/use-agent-presence.spec.ts
pnpm --filter @crm/web exec vitest run src/components/users/user-list-view.spec.tsx
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
