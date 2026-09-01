> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/customer-portal-notification-preferences/customer-portal-notification-preferences/intake.md`

---

## Feature

- **Feature name (display):** Notifications / Customer Portal
- **Feature slug (folder under `plans/`):** `customer-portal-notification-preferences`

## Title

```text
Story 90 — Customer Portal: Notification Preferences
```

## Description

```text
Story 58 let each agent mute the live in-app toast for any of three
branch-wide notification event types, self-scoped by User. Story 86 gave
the Customer Portal its own live in-app toast (ticket.updated and
agent-reply channel.message.created, relayed into a per-customer socket
room), and Story 89 gave it a persisted history view — but no portal
equivalent of Story 58's preferences ever shipped; Story 89's own plan doc
named this gap explicitly and deferred it only because the history
endpoint itself had no frontend consumer yet. That blocker is now resolved.
This story ports Story 58's preference mechanism to the Customer Portal: a
brand-new, contact-scoped PortalNotificationPreference model (a separate
table from the agent-side NotificationPreference, mirroring this
codebase's own ContactRefreshToken-vs-RefreshToken precedent), a
GET/PATCH /portal/notification-preferences pair, a client-side toast
filter in PortalNotifications, and a new Preferences section on the
existing portal Notification History page.
```

## Acceptance criteria

```text
- [ ] New PortalNotificationPreference Prisma model (contactId-scoped,
      notifications schema, cross-schema FK to Contact), migrated.
      NotificationPreference (Story 58) is untouched.
- [ ] New GET/PATCH /portal/notification-preferences, @PortalRoute()
      (rejects an agent-audience token with 401), self-scoped via
      PortalService.getAuthenticatedContact — no cross-contact leakage.
      GET always returns exactly the two portal event types
      (ticket.updated, channel.message.created), defaulting a missing row
      to inAppEnabled: true. PATCH upserts one {eventType, inAppEnabled}
      pair; 400 for an unrecognized eventType.
- [ ] apps/portal/src/components/portal/portal-notifications.tsx fetches
      the caller's preferences and skips forwarding a disabled event
      type's incoming socket payload to the notifications store (defaults
      to enabled while the preferences query is loading/erroring).
- [ ] New apps/portal/src/components/portal/notification-preferences-section.tsx
      renders on the existing notification history page, above the table:
      two toggle rows, independent loading/error/populated state.
- [ ] apps/portal/messages/en.json and ar.json both gain a
      notifications.preferences.* sub-object, with no existing key
      modified.
- [ ] New backend unit spec (portal-notification-preferences.service.spec.ts)
      and e2e spec (portal-notification-preferences.e2e-spec.ts, including
      an agent-audience-token-rejected case and a cross-contact-isolation
      case) both pass.
- [ ] New/extended frontend specs cover the preferences section's
      loading/error/toggle states and the toast-filter behavior.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e,
      pnpm --filter @crm/portal test, pnpm typecheck, pnpm lint, and
      pnpm build all pass. Every pre-existing test remains green,
      unweakened.
```

## Dependencies

- Story 58 — `notification-preferences` (the exact per-user preference
  shape/mechanism this story ports to `Contact`).
- Story 86 — `customer-portal-notification-delivery`
  (`CustomerNotificationRealtimeListener`, `usePortalNotifications`/
  `PortalNotifications`, the exact two event types and client mount point).
- Story 89 — `customer-portal-notification-history-frontend`
  (`NotificationHistoryView`, the page this story's new section renders on;
  the existing `notifications` i18n namespace's `eventLabel.*` keys).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Any change to `NotificationPreference` (Story 58) or agent-facing
  behavior.
- Server-side per-recipient delivery targeting.
- Preferences affecting `NotificationLog`/history visibility.
- "Mark as read"/unread-count/badge state.
- Email/SMS/push channel preferences.
- Notification templates for the portal.
