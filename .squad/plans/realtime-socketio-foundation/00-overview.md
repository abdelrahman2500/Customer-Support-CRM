# realtime-socketio-foundation — plan overview

Entry point for the **realtime-socketio-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 20  | [20-story-realtime-socketio-foundation.md](./20-story-realtime-socketio-foundation.md) | Realtime / Socket.IO Foundation | — | `ticket-recategorization-sla-target-recomputation` Story 16, `sla-breach-escalation` Story 17 |

## Dependency notes

- New feature slug, new cross-cutting infrastructure area (`apps/api/src/realtime/`) — not a domain module under `apps/api/src/modules/`, mirroring how `apps/api/src/queues/` (BullMQ, Story 14) sits alongside `modules/` rather than inside it. docs/architecture/06-communication-and-realtime.md's "Real-time communication" section is likewise a cross-cutting concern separate from the domain-boundaries table (docs/architecture/03-domain-boundaries.md).
- Reuses the existing JWT access-token primitives (`JwtService`, `JwtAccessTokenClaims`, the `audience: "agent"` rule) rather than introducing a parallel auth mechanism — the same manual-`JwtService.verify()`-outside-the-HTTP-pipeline pattern `TenantMiddleware` (Story 02) already established for a non-Guard context.
- Consumes `TICKET_UPDATED_EVENT` (Story 08) and `TICKET_ESCALATED_EVENT` (Story 17) exactly as already emitted — no existing emitter, listener, or event payload is modified.
- Does not modify `apps/worker/**`, any existing BullMQ queue, any existing Notifications-domain listener, or Stories 17–19 behavior.
- No Prisma schema/migration change — no persistent realtime state is introduced.
