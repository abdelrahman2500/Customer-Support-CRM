> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Notifications — Custom Message Templates (Foundation)
- **Feature slug:** `notification-templates`

## Description

```text
Recon after Story 60 (confirmed via a full Feature Progress Audit) found "Templates" as the last of
Notifications' three named pieces (docs/architecture/03-domain-boundaries.md) still unaddressed —
delivery logs and per-user preferences (Stories 36/58) both shipped. Preferred over Administration/
branding (the only other concrete gap), whose defining behavior — cross-cutting CSS-variable theming
in both frontend apps — is a materially larger, riskier lift than this. Deliberately scoped to
consumption in the Notification History table only, not the live in-app toast, to avoid regression
risk in a real-time-critical UI surface.
```

## Acceptance criteria

```text
- POST/GET/PATCH /notification-templates exist, gated by new notification:create/update permissions
  (reusing existing notification:read for GET), branch-scoped.
- A template is plain text with {ticketId}/{targetType} placeholders, upserted per (branch, eventType).
- The existing Notification History table renders a custom template when one exists for a row's
  eventType, and falls back to the existing hardcoded label otherwise (zero behavior change by default).
- A new Agent Workspace screen lists/creates/edits templates, one row per fixed event type.
- English and Arabic translations exist for every new string.
- Backend unit and e2e tests, and frontend component tests, cover the new surface.
- Every pre-existing test suite remains green, unweakened — especially NotificationHistoryView's
  existing tests, unmodified, proving the fallback path is behavior-preserving.
```

## Dependencies

- **Blocked by / related ids:** `notifications-read-endpoint` Story 36, `notification-preferences` Story 58.

## Out of scope

- Live in-app toast consumption, email/SMS/push template rendering, a full ICU/i18n templating
  engine, per-user templates, template versioning/preview.
- Any README change.
