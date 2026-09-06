## Presence Recon: stale agent presence is a real production bug

The latest E2E/production-state Recon confirmed that the previously suspected Identity E2E isolation defect is already resolved and must NOT become a new implementation story.

Identity verification:

- `identity.e2e-spec.ts` passes 77/77 in two consecutive runs without a seed between runs.
- The Agent-grant-dependent specs immediately afterward pass 63/63.
- Existing `afterAll` cleanup restores Agent permissions, deactivates stray SuperAdmins, and restores the seed admin/Main Branch.
- No Identity production or test-isolation fix is currently required.

The actual production issue discovered during that Recon is stale agent presence.

### Root cause

Redis presence keys such as:

`presence:<userId>`

can retain stale socket IDs indefinitely.

Observed state:

- one `presence:<admin>` key had `ttl = -1`
- other presence keys had finite TTLs
- presence keys currently have no reliable expiration guarantee
- `srem` cleanup does not execute when the API/socket process dies unexpectedly

Therefore, if an API/socket process crashes, an agent can remain permanently "online" even though the socket no longer exists.

Changing E2E tests to use a fresh user would hide the defect and is explicitly NOT acceptable.

### Required outcome

Presence must eventually expire after an unexpected process/socket-process death.

The design must preserve correct multi-socket behavior if the existing architecture supports multiple simultaneous sockets for one agent:

- one socket disconnecting must not mark the agent offline if another active socket remains
- stale socket IDs must not keep an agent permanently online
- normal disconnect behavior must continue to work
- heartbeat/refresh behavior must not accidentally expire healthy connections
- reconnecting must restore presence correctly

### Scope

Investigate and fix the existing presence implementation with the smallest safe production change.

Likely areas:

- Presence service
- Redis key/value/set structure
- TTL handling
- heartbeat/refresh
- Socket.IO connect/disconnect lifecycle
- existing presence E2E/unit tests

Do NOT assume a TTL-only fix is sufficient until the existing socket representation and lifecycle are understood.

### Testing requirements

Add regression coverage for:

- presence creation
- TTL/expiration behavior
- heartbeat/refresh while the connection is alive
- stale presence eventually disappearing
- normal disconnect
- multi-socket behavior if supported by the current implementation
- reconnect behavior
- branch/tenant/user isolation where relevant

Do not weaken tests to hide stale presence.

### Out of scope

Do NOT include:

- Identity E2E fixes
- ticket default sorting
- ticket/customer pagination
- SLA ordering changes
- UI redesign
- unrelated Redis refactors
- dependency changes
- CI changes
- database schema changes unless absolutely proven necessary

### Important

This is an engineering correctness story.

Do not invent product behavior beyond the existing presence contract.

Preserve existing API/frontend semantics unless the current stale-presence bug requires a minimal correction.
