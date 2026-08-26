# background-job-producer-foundation — plan overview

Entry point for the **background-job-producer-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File                                                                     | Title                              | Tracker id | Depends on                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 14  | [14-story-background-job-producer-foundation.md](./14-story-background-job-producer-foundation.md) | Background Job Producer Foundation | —          | `project-foundation` Story 02 |

## Dependency notes

- This is a new, cross-cutting infrastructure feature slug — deliberately **not** filed under `sla-policy-foundation`. The API-side BullMQ producer capability this story establishes is shared backbone for five separate, unrelated future domains named in [docs/architecture/06-communication-and-realtime.md](../../../docs/architecture/06-communication-and-realtime.md) (`sla-timers`, `notifications`, `integration-sync`, `ai-processing`, `reports-refresh`) — it is not an SLA-owned concern, and filing it there would misrepresent its scope. The closest existing precedent for "cross-cutting infrastructure, not a bounded-context feature" is `project-foundation` Story 02, which built the **consumer**-side half of this exact same backbone (`apps/worker` + the `health-check` queue). This feature completes the **producer** side, as its own slug rather than reopening `project-foundation` (whose own `docs/architecture/README.md` status line already declares it "established" as a closed arc).
- Story 14 is the only story in this feature so far. It was identified via a roadmap recon performed after `sla-policy-foundation` Story 13 as the smallest technically-unblocked cross-cutting increment remaining in the repository — every other named future capability (SLA timers/escalation, Notifications, Channels, Knowledge Base, AI, Reporting, Portal, Integrations, Administration) was either blocked on this exact producer foundation or on a separate human decision.
- Story 14 deliberately does **not** introduce any real business queue (`sla-timers`, `notifications`, `integration-sync`, `ai-processing`, `reports-refresh`) or any job-processing behavior. It reuses the **existing** `health-check` queue (`project-foundation` Story 02) purely as an infrastructure-verification fixture. Real queues remain the responsibility of the future feature stories that actually need them.
