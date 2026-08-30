# notification-preferences — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 58  | [58-story-notification-preferences.md](./58-story-notification-preferences.md) | Notifications — Per-User In-App Preferences | — | `in-app-notification-delivery` (Story 22's `BranchNotificationRealtimeListener`, Story 24's `useBranchNotifications`/`BranchNotifications`) |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2) after Story 57. `docs/architecture/03-domain-boundaries.md`'s Notifications row names "per-user preferences" as part of what this domain owns; only `NotificationLog` (delivery/history) has ever been built — no preference model or endpoint exists.
- No external-provider blocker (unlike AI Services/Communication-Channels/Integrations). Fits entirely inside the already-existing `notifications` schema/module, needs no new dependency.
- **Deliberately scoped to the live in-app toast only**, not `NotificationLog`/history: Recon found `BranchNotificationRealtimeListener` relays branch-wide (Design items 1-4 of Story 22 — no per-recipient resolution at all), so building true per-user *server-side* delivery targeting would mean restructuring that broadcast into per-user rooms — a materially bigger, riskier change than "let each agent mute a live toast type for themselves," which the existing branch-wide broadcast already supports via a client-side filter with no backend delivery-path change. Server-side per-recipient targeting is deferred to a future story if real demand emerges.
- Preferred over further-expanding Reporting (Story 56) or Automation Rules (Story 57): both already have a deliberately scoped, complete-for-v1 foundation; this closes a different, still fully-unaddressed documented capability instead of layering more onto an already-shipped one.
