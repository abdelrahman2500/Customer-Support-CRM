# notifications-read-endpoint — plan overview

## Stories

| NN | File | Title | Depends on |
| --- | --- | --- | --- |
| 36 | [36-story-notifications-read-endpoint.md](./36-story-notifications-read-endpoint.md) | Backend Foundation: Notification Read Endpoint | `sla-at-risk-notification-reaction` Story 18, `ticket-escalation-notification-reaction` Story 19 |

## Dependency notes

- Gives the existing `NotificationsModule` its first controller/service (`NotificationsController`/`NotificationsService`) — the module itself already existed (Story 18/19's listeners).
- Adds one new permission key (`notification:read`). No schema/migration change.
- Part of the approved 35/36/37 backend-foundation batch — owns the `notifications` module exclusively; zero file overlap with 35/37 beyond the shared, purely-additive `seed.ts` permission array.
