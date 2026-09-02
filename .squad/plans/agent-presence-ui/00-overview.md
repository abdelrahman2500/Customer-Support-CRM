# agent-presence-ui — plan overview

Entry point for the **agent-presence-ui** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 108 | [108-story-agent-presence-ui.md](./108-story-agent-presence-ui.md) | Agent Workspace — Agent Presence UI | — | Story 71 (`PresenceService`/`RealtimeGateway`'s `agent:{id}:presence` room) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 113 closed
  (the Observability arc), from the standing, user-approved unblocked
  backlog (108, 109, 110, 114, 115 remaining at that point). Chosen on
  **dependency correctness** (CLAUDE.md §2 priority 1): unlike the other
  four candidates (109 multi-locale KB, 110 saved dashboards, 114
  Playwright E2E, 115 audit-log DB grants — each starting a fresh domain
  area from nothing), 108 is the only one *completing an already-built,
  currently-unconsumed foundation*. Story 71 shipped `PresenceService`
  (Redis-backed online/offline tracking) and `RealtimeGateway`'s
  `agent:{id}:presence` room/`agent.presence.changed` event, fully tested,
  with zero frontend consumers — `use-ticket-realtime.ts`'s own doc
  comment explicitly flags this room as "out of scope for this story."
  Building the frontend half of an existing, idle foundation is exactly
  what §2 priority 1 asks to prefer over starting something new.
- **Why not one of the 8 externally-blocked Stories (116-123)**: purely
  internal — reuses an already-authenticated Socket.IO connection
  mechanism (`getAccessToken`/`getSocketBaseUrl`) already used by every
  other realtime hook in this codebase; no new external dependency.
- **Architectural coherence**: `useAgentPresence` (new hook) mirrors
  `useBranchNotifications`'s exact "one hook, one socket, joined on
  connect" shape (Story 24), generalized from one fixed room to a list of
  rooms driven by the caller's own data — no new socket-connection pattern
  introduced. Backend-side: zero changes. `RealtimeGateway`'s
  `authorizeRoom` already fully implements the "own id, or same-branch
  membership" authorization Story 71 shipped; this story is a pure
  consumer.
- **Product value**: a real, visible Agent Workspace feature — "who's
  online" — on the single most natural existing surface for it (the Users
  admin list, which already lists every agent in the branch by email/
  fullName/role/department/status). Outranks 114 (Playwright E2E, test
  infrastructure — §2 priority 4, risk reduction, explicitly ranked below
  product value) and 115 (audit-log DB grants — pure hardening with no
  user-facing value) on priority 3; 108 already wins outright on priority
  1 regardless.
- **Scope decision — where the presence indicator lives**: the Users
  admin list (`UserListView`/`UserRow`, Story 32/47/48's existing table),
  not a new page or a ticket-assignment picker. This is the one place in
  the current Agent Workspace that already renders a flat list of every
  agent in the branch — the natural, minimal integration point, adding
  one column to an existing table rather than a new UI surface.
