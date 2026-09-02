> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/agent-presence-ui/agent-presence-ui/intake.md`

---

## Feature

- **Feature name (display):** Agent Workspace — Agent Presence UI
- **Feature slug (folder under `plans/`):** `agent-presence-ui`

## Title

```text
Story 108 — Agent Workspace: Agent Presence UI
```

## Description

```text
Story 71 built PresenceService and RealtimeGateway's agent:{id}:presence
room/agent.presence.changed event, fully tested, with zero frontend
consumers. This story adds useAgentPresence (mirroring
useBranchNotifications's shape, generalized to a list of rooms) and wires
it into the Users admin list -- the one existing surface that already
lists every agent in the branch -- via a new "Presence" column.
```

## Acceptance criteria

```text
- [ ] useAgentPresence joins agent:{id}:presence for every given user id
      on connect; updates on agent.presence.changed; no-ops on empty
      userIds/missing token; reconnects on userIds change; cleans up on
      unmount.
- [ ] UserListView renders a "Presence" column, defaulting to Offline
      before any event arrives.
- [ ] No backend files changed.
- [ ] Unit coverage for both the hook and the UI integration.
- [ ] Full verification cycle green for apps/web.
```

## Dependencies

- Story 71 — `PresenceService`/`RealtimeGateway`'s `agent:{id}:presence`
  room and `agent.presence.changed` event (unmodified).
- Story 24 — `useBranchNotifications`'s hook shape, mirrored here.
- Story 32/47/48 — the existing `UserListView`/`UserRow` table this
  story adds a column to.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Presence indicators anywhere else in the Agent Workspace.
- A "last seen" timestamp or richer presence states (away/busy).
- Any change to `apps/api`'s realtime module.
