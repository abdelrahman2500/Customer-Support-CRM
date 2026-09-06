# RM-19 — Portal Email Notification Delivery

**Priority:** P2 · **Complexity:** Small-Medium · **Blocked:** Depends on `RM-15` · **Phase:** 5 (Email/WhatsApp/SMS)

## Goal

Deliver a subset of existing portal `NotificationLog` events to the
customer's email address, so a customer who isn't actively viewing the
portal still learns their ticket was answered or resolved.

## Why it exists

`customer-portal-notification-delivery` (Story 86)'s own plan explicitly
lists "no email/SMS/WhatsApp delivery" as a first-iteration non-goal,
deferred to a later story — confirming this is a genuine, disclosed,
still-open gap, not an oversight this roadmap is duplicating. In-app
delivery, history, and preferences are already fully built (Stories
86/88/90); only the email-delivery leg is missing.

## Dependencies

Hard dependency on `RM-15` (Email outbound adapter) existing and having a
configured SMTP transport (dev: Mailhog; production: gated on the same
Phase 0 decision).

## Backend work

- A new notification-delivery consumer subscribing to the same events
  `PortalNotificationLogListener` already handles (`ticket.updated`,
  `channel.message.created`), reusing the existing `NotificationPreference`
  toggles — a customer who has disabled a given event type for in-app
  delivery should not receive it by email either, unless a separate,
  explicit email-specific preference is judged necessary (default to
  reusing the existing toggle for simplicity, per this codebase's own
  "personal config, no dedicated permission" precedent for similar
  preference-shaped features).
- Uses `RM-15`'s `EmailAdapter` directly — no second SMTP integration.

## Frontend work

- Minor: if a separate email-specific preference is introduced (see
  above), a corresponding toggle in the existing notification-preferences
  UI; if the existing toggle is reused as-is, no frontend change is needed
  at all.

## Worker/realtime work

Reuses `RM-15`'s existing outbound send path — no new worker logic beyond
subscribing to the existing events.

## Schema/migration work

None, unless a separate email-specific preference field is added to
`NotificationPreference` (decide during implementation).

## Tests

- New e2e coverage: a `ticket.updated` event for a customer with email
  notifications enabled produces both the existing in-app `NotificationLog`
  row and a verifiable Mailhog-delivered email; a customer with the
  relevant preference disabled receives neither.

## Acceptance criteria

- A ticket-update event produces both the existing in-app notification and
  a delivered email, gated by the existing (or a new, explicit)
  preference toggle.
- This is explicitly distinct from the Email *communication channel*
  (`RM-15`/`RM-16`) — this is one-way transactional delivery of an
  already-existing notification, not a customer-reply-by-email flow.

## Definition of Done

- Blocked identically to `RM-15` for production rollout; fully
  implementable and testable in dev/CI against Mailhog today, same caveat.
- All acceptance criteria verified against Mailhog.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm typecheck`, `pnpm lint`,
  `pnpm build` pass.
- One dedicated commit, pushed.
