# notification-templates — plan overview

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | ---- | ----- | ---------- | ---------- |
| 61  | [61-story-notification-templates.md](./61-story-notification-templates.md) | Notifications — Custom Message Templates (Foundation) | — | `notifications-read-endpoint` Story 36 (`NotificationLog`/`NotificationsController`), `notification-preferences` Story 58 (the module this joins) |

## Dependency notes

- Selected via the autonomous Recon cycle (`CLAUDE.md` §2/§8) after Story 60, per the Feature Progress Audit's Next-Story Context: `docs/architecture/03-domain-boundaries.md`'s Notifications row names "Templates" as owned scope; only delivery logs and per-user preferences (Stories 36/58) exist. This is the last of Notifications' three named pieces.
- Preferred over Administration/branding (the other concrete gap): branding's core defining behavior is "consumed by both Next.js apps through Tailwind CSS variables" — shipping it without that consumption ships something inert; the CSS-variable-injection work itself is a materially larger, riskier lift (previously deprioritized twice for this reason). Templates, by contrast, are meaningfully useful the moment an admin can manage them, even before every consumption surface is wired up.
- **Deliberately scoped to consumption in the Notification History table only, not the live in-app toast**: `NotificationToaster`'s `messageFor()` is a more involved, currently-untested-for-templating rendering path feeding a user-facing, real-time UI surface; the History table is a lower-risk, already-permission-gated read view. Wiring templates into the live toast is a natural, separate follow-up once this foundation is proven, not attempted here (avoids risking a regression in a working, real-time-critical surface for the sake of one story).
- No new schema — a new model within the already-declared `notifications` schema, mirroring `NotificationPreference`'s own precedent from Story 58.
- Communication/Channels, AI Services, and Integrations remain blocked on an unresolved external provider/credential (unchanged).
