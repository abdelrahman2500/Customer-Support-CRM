# notification-templates-live-toast — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 63  | [63-story-notification-templates-live-toast.md](./63-story-notification-templates-live-toast.md) | Notifications — Custom Templates in the Live Toast | — | `notification-templates` Story 61 (`NotificationTemplate`, its History-table consumption) |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2/§8) after Story 62. Story 61 deliberately deferred live in-app toast consumption of `NotificationTemplate` as a separate follow-up (not a genuine blocker — a caution against touching a real-time-critical surface without first proving the data model/CRUD in a lower-risk one). That data model and CRUD are now proven (Story 61's own tests, plus a full cycle of production stories built on top of it since). This closes that deferred increment.
- Preferred over live branding CSS-variable consumption (Story 62's own deferred non-goal): that change is materially larger (touches both frontend apps' shared root layouts) and riskier (the architecture's own risk log names RTL regressions from exactly this kind of cross-cutting layout change) than extending one already-modified component (`NotificationToaster`) in one app.
- Preferred over a wider SLA & Automation action set: that still has a genuinely unresolved precondition (a target-desync reconciliation design), not just caution — this story has none.
- No backend change at all — pure frontend consumption of an already-shipped, already-tested endpoint (`GET /notification-templates`).
- Communication/Channels, AI Services, and Integrations remain blocked on an unresolved external provider/credential (unchanged).
