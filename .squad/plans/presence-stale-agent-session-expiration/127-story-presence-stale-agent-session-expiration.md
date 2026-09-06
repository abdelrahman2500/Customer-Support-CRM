# Story 127 — Presence stale agent session expiration

## Prerequisites

- Story 71 completed: the Redis-backed `PresenceService` and `RealtimeGateway` presence room contract already exist and are the production baseline for this fix.
- Story 108's frontend consumer remains a useful precedent for the contract shape: [../agent-presence-ui/108-story-agent-presence-ui.md](../agent-presence-ui/108-story-agent-presence-ui.md) confirms the room/event contract is still `agent:{id}:presence` and `agent.presence.changed`.
- Intake/Recon source: `.squad/stories/presence-stale-agent-session-expiration/presence-stale-agent-session-expiration/intake.md`.

## Story Goal

Fix the stale-agent presence bug without changing the existing API/frontend semantics beyond the minimum required to expire dead socket-state correctly.

1. A dead or crashed API/socket process must not leave an agent permanently marked as online.
2. A single socket disconnect must not mark the agent offline while another socket remains active.
3. Normal disconnect, reconnect, and heartbeat refresh behavior must continue to work with the existing Redis-backed presence model.

### Not in scope

- Identity E2E isolation work.
- UI redesign or new presence states.
- Database schema changes unless a precise Redis-only fix is proven impossible.
- Unrelated Redis refactors or dependency changes.

## Context — Read These Files First

1. `apps/api/src/realtime/presence.service.ts` — read the `PresenceService` implementation around `recordConnect`, `recordDisconnect`, and `isOnline` (~lines 42–80). Confirm how the current Redis Set (`presence:<userId>`) has no TTL/cleanup and why stale socket IDs can survive an unexpected process death.
2. `apps/api/src/realtime/realtime.gateway.ts` — read the `RealtimeGateway` lifecycle around `connectedSockets`, `handleConnection`, `handleDisconnect`, and `onModuleDestroy` (~lines 102–170). Confirm when each socket is tracked, when `trackDisconnect` is called, and why graceful shutdown still yields no stale state.
3. `apps/api/src/realtime/presence.service.spec.ts` — read the unit tests around the service (`recordConnect`/`recordDisconnect`/`isOnline`) (~lines 32–107). Keep the regression tests in the same style and cover the stale-expiration edge cases without weakening the existing semantics.
4. `apps/api/test/realtime-socketio-foundation.e2e-spec.ts` — read the live presence suite in the `agent presence` describe block (~lines 231–313). Preserve the real contract: same-branch watch access, online/offline broadcasts, and current-status join semantics.
5. Intake: `.squad/stories/presence-stale-agent-session-expiration/presence-stale-agent-session-expiration/intake.md` — use it as the acceptance and risk baseline for stale dead-socket cleanup and multi-socket behavior.

## Implementation tasks

### 1. Fix the Redis presence model without breaking the existing contract

File: `apps/api/src/realtime/presence.service.ts`

- Inspect the current Set-based model and replace the implicit “never expires” behavior with a minimal TTL-aware strategy that still preserves multi-socket semantics.
- Keep the user-level `presence:<userId>` set as the source of truth for whether at least one live socket remains, but add a per-socket or per-connection expiration record so a crashed process cannot keep stale socket IDs alive forever.
- Ensure the algorithm distinguishes between:
  - a healthy connection that is still alive and should be kept online,
  - an expired or stale socket ID that should be purged,
  - a disconnect that should only flip the user offline when the last remaining socket is gone.
- Preserve the existing `recordConnect`/`recordDisconnect` boolean contract: only the first connection and the last disconnection are real transitions.

### 2. Update the socket lifecycle to reconcile stale connection state

File: `apps/api/src/realtime/realtime.gateway.ts`

- Review the current `connectedSockets` map and the `handleConnection`/`handleDisconnect` flow (`client.id` -> `userId`).
- Keep the graceful-shutdown path intact but make sure the gateway writes the latest socket membership state in a way that can be safely reconciled with TTL expiry during unexpected crashes.
- Do not silently change the room authorization or the `agent.presence.changed` event payload; the fix must stay within the same contract already exercised in the e2e suite.

### 3. Add regression coverage for expiration, reconnect, and multi-socket correctness

File: `apps/api/src/realtime/presence.service.spec.ts`

- Add unit coverage for:
  - presence creation with a fresh socket,
  - TTL expiry removing stale socket membership,
  - a heartbeat/refresh keeping a healthy connection alive,
  - disconnect logic leaving the agent online when another socket still exists,
  - reconnect restoring presence correctly after a stale socket was removed.

File: `apps/api/test/realtime-socketio-foundation.e2e-spec.ts`

- Extend the existing `agent presence` describe block with a real Redis-backed regression around stale socket expiration and reconnect behavior.
- Confirm the e2e contract still matches the current watcher/online/offline broadcast behavior while the fix is active.

## Edge Cases & Failure Modes

- If a socket dies without a graceful `disconnect`, the stale Redis entry must expire instead of staying infinite. The enforcement point is the Redis presence key logic in `apps/api/src/realtime/presence.service.ts` (~lines 42–80).
- If a user has multiple sockets, disconnecting one must not produce a false offline event while another remains. The state transition guard is in `recordDisconnect` in `apps/api/src/realtime/presence.service.ts` (~lines 73–80) and the gateway’s `handleDisconnect` logic in `apps/api/src/realtime/realtime.gateway.ts` (~lines 155–169).
- If a stale socket ID remains after a crash, a later reconnect must rebuild the user’s presence set without duplication or permanent dead entries. This is enforced by the same `recordConnect`/`recordDisconnect` logic and the `connectedSockets` map in `apps/api/src/realtime/realtime.gateway.ts` (~lines 102–169).
- If heartbeat refresh runs while the connection is still active, it must not accidentally expire a healthy socket. The TTL/heartbeat policy belongs in `apps/api/src/realtime/presence.service.ts` and must be validated against the existing service tests.
- If graceful shutdown is triggered during app close, the existing module-destroy disconnect path must continue to emit the expected final offline state without racing the Redis shutdown logic. This is the behavior already documented in `apps/api/src/realtime/realtime.gateway.ts` (~lines 118–169).

## Test Plan

1. Unit: add stale-expiration and multi-socket tests in `apps/api/src/realtime/presence.service.spec.ts` for `recordConnect`, `recordDisconnect`, `isOnline`, and TTL/heartbeat reconciliation.
2. Unit: expand the same file to cover reconnect behavior and dirty-key cleanup after a stale socket remains behind after an unexpected process death.
3. E2E: extend the real Socket.IO presence suite in `apps/api/test/realtime-socketio-foundation.e2e-spec.ts` to assert that a stale socket falls out of presence without affecting the active socket set or existing same-branch join semantics.
4. Regression: rerun the “agent presence” assertions to ensure the event payload remains `{ userId, status: "online" | "offline" }` and the existing offline/online broadcast flow still works.

## Verification Steps

1. **Backend unit tests:**
   - `cd apps/api && pnpm exec vitest run src/realtime/presence.service.spec.ts`
2. **Realtime regression:**
   - `cd apps/api && pnpm exec vitest run test/realtime-socketio-foundation.e2e-spec.ts --no-file-parallelism`
3. **Relevant project validation:**
   - `cd apps/api && pnpm test`
   - `cd apps/api && pnpm test:e2e`
4. **Final repo health check:**
   - `cd E:/Algoriza/Customer Support CRM && git status --short`

## Done Criteria

- [ ] Stale socket IDs no longer keep an agent marked online after an unexpected process/socket death.
- [ ] Disconnecting one socket does not mark the user offline when another active socket remains present.
- [ ] Healthy heartbeats do not expire active sockets prematurely.
- [ ] Reconnect flow restores correct presence state without duplicate or sticky stale entries.
- [ ] Existing same-branch watch behavior and `agent.presence.changed` event semantics remain unchanged.
- [ ] The regression tests in `apps/api/src/realtime/presence.service.spec.ts` and `apps/api/test/realtime-socketio-foundation.e2e-spec.ts` pass.
