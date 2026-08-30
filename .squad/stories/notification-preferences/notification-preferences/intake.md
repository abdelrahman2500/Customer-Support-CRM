> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Notifications — Per-User In-App Preferences
- **Feature slug:** `notification-preferences`

## Description

```text
Recon after Story 57 found "per-user preferences" (docs/architecture/03-domain-boundaries.md's
Notifications row) as still fully unaddressed — only NotificationLog (delivery/history) exists.
No external-provider blocker. Scoped to the live in-app toast only (client-side filter), since the
existing branch-wide broadcast has no per-recipient server-side resolution at all — restructuring
that is separate, larger scope.
```

## Acceptance criteria

```text
- GET/PATCH /notification-preferences exist, self-scoped by the JWT's own subject, no new
  permission (mirrors GET /auth/me's precedent).
- Disabling an event type suppresses only that user's own live toast for it; no cross-user effect.
- A new Preferences section renders independent of the notification:read-gated history table.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and frontend component tests, cover the new surface.
- Every pre-existing test suite remains green, unweakened.
```

## Dependencies

- **Blocked by / related ids:** `in-app-notification-delivery` (Story 22/24).

## Out of scope

- Server-side per-recipient delivery targeting; NotificationLog/history filtering; email/SMS/push
  channel preferences; notification templates.
- Any README change.
