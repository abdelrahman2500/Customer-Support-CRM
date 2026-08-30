> **Source:** autonomous Next-Story Recon (no tracker), per `CLAUDE.md`.

# Story intake

## Feature

- **Feature name (display):** Notifications — Custom Templates in the Live Toast
- **Feature slug:** `notification-templates-live-toast`

## Description

```text
Recon after Story 62 confirmed the only remaining unblocked increments are deferred pieces of
already-shipped foundations: this one (Story 61's own deferred live-toast consumption, now safe
since the data model/CRUD are proven), live branding CSS-variable consumption (larger, riskier —
touches both apps' shared layouts), and a wider SLA automation action set (still has a genuine
unresolved reconciliation-design precondition, not just caution). Picked the smallest, safest,
most concretely-actionable of the three. No backend change — pure frontend consumption of an
already-existing endpoint.
```

## Acceptance criteria

```text
- A shared renderNotificationTemplate helper is extracted; both NotificationHistoryView and
  NotificationToaster use it, with no duplicated substitution logic.
- The live toast renders a custom template's substituted message when one exists for a
  notification's event type; falls back to the exact existing hardcoded message otherwise.
- The toast's Badge event-type label is unaffected by a custom template.
- Frontend unit and component tests cover the new surface; every pre-existing test (especially
  NotificationHistoryView's and NotificationToaster's own) remains green, unmodified.
```

## Dependencies

- **Blocked by / related ids:** `notification-templates` Story 61.

## Out of scope

- Changing the toast Badge's label, live branding CSS-variable consumption, any change to the
  branch-wide broadcast/BranchNotificationRealtimeListener.
- Any README change.
