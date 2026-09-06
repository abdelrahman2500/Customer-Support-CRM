# presence-stale-agent-session-expiration — plan overview

Entry point for the **presence-stale-agent-session-expiration** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 127 | [127-story-presence-stale-agent-session-expiration.md](./127-story-presence-stale-agent-session-expiration.md) | Presence stale agent session expiration | — | Story 71 (`PresenceService`/`RealtimeGateway` agent-presence foundation) |

## Dependency notes

- This is the first story in this feature's plan and depends directly on the already-shipped Redis-backed presence infrastructure from Story 71.
- The fix is intentionally scoped to the production stale-presence bug: it should not change the API/frontend presence contract beyond minimal TTL/cleanup and multi-socket correctness.
- The live e2e contract remains the same as the existing `agent presence` suite in `apps/api/test/realtime-socketio-foundation.e2e-spec.ts`, so this story should preserve the current same-branch join semantics and online/offline event payloads.
