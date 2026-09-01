# Story 90 — Customer Portal: Notification Preferences

## Prerequisites

- `notification-preferences` Story 58 —
  `apps/api/src/modules/notifications/{notification-preferences.service,notification-preferences.controller}.ts`,
  `apps/web/src/components/notifications/{branch-notifications,notification-preferences-section}.tsx` —
  the exact per-user preference shape and client-side-filter mechanism this
  story ports to the Customer Portal / `Contact`.
- `customer-portal-notification-delivery` Story 86 —
  `apps/api/src/realtime/customer-notification-realtime.listener.ts` (the
  exact two event types, `ticket.updated`/`channel.message.created`, this
  story's preferences govern), `apps/portal/src/hooks/use-portal-notifications.ts` /
  `apps/portal/src/components/portal/portal-notifications.tsx` (the exact
  client mount point this story's filter is added to).
- `customer-portal-notification-history-frontend` Story 89 —
  `apps/portal/src/components/portal/notification-history-view.tsx` (the
  page this story's new Preferences section renders on), the portal's
  existing `notifications` i18n namespace's `eventLabel.ticketUpdated`/
  `eventLabel.newReply` keys (reused verbatim, not re-declared).

All are complete and already merged to `main`.

## Story Goal

Let a signed-in Customer Portal contact turn off the live in-app toast for
either `ticket.updated` or agent-reply `channel.message.created`, for
themselves, without affecting any other contact or any agent. Closes
`docs/architecture/03-domain-boundaries.md`'s Notifications row's
"per-user preferences" for the Customer Portal audience — the portal-side
counterpart of Story 58's agent-side capability.

## Non-Goals

- **No change to `NotificationPreference` (Story 58) or any agent-facing
  behavior.** A brand-new `PortalNotificationPreference` model instead —
  see Design decision 1.
- **No server-side per-recipient delivery targeting.** The existing
  `customer:{customerId}:notifications` room broadcast (Story 86) is
  unchanged; this story adds a client-side filter only, exactly mirroring
  Story 58's own scope boundary on the agent side.
- **No preferences affecting `NotificationLog`/history visibility.**
  `NotificationHistoryView` (Story 89) keeps showing every logged row
  regardless of this story's preference state — identical to Story 58's own
  "governs only the live toast, never history" rule.
- **No "mark as read"/unread-count/badge state.** Unrelated to preferences;
  remains a disclosed, separate non-goal (Story 89).
- **No email/SMS/push channel preferences.** No such channel exists yet.
- **No notification-templates for the portal.** Unrelated, separate,
  already-disclosed non-goal (Story 89).

## Design decisions

1. **A brand-new `PortalNotificationPreference` Prisma model, contactId-scoped,
   not a widened `NotificationPreference`.** Mirrors this exact codebase's
   own established precedent for the identical "same concept, `User` vs.
   `Contact`" situation: `ContactRefreshToken` is a separate table from
   `RefreshToken`, not a widened shared one, specifically so the owning
   schema's Contact lifecycle stays self-contained and the already-shipped
   `NotificationPreference`/`User` relationship is never touched. Lives in
   the `notifications` schema (this domain owns "per-user preferences";
   `Contact` itself stays owned by `customers`), with a cross-schema FK to
   `Contact` — the exact pattern `NotificationLog.customerId`/`Customer`
   and `ChannelMessage.senderContactId`/`Contact` already use.
   ```prisma
   model PortalNotificationPreference {
     id           String   @id @default(uuid())
     contactId    String   @map("contact_id")
     contact      Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
     eventType    String   @map("event_type")
     inAppEnabled Boolean  @default(true) @map("in_app_enabled")
     createdAt    DateTime @default(now()) @map("created_at")
     updatedAt    DateTime @updatedAt @map("updated_at")

     @@unique([contactId, eventType])
     @@map("portal_notification_preferences")
     @@schema("notifications")
   }
   ```
   `Contact` gains the back-relation `portalNotificationPreferences PortalNotificationPreference[]`
   — the same kind of cross-schema back-relation `Contact` already carries
   for `channelMessages`/`chatSessions`.
2. **Absence of a row means "enabled"** — identical to Story 58's own
   "no row/null field = unrestricted" convention.
3. **No new permission.** Self-scoped, resolved from the portal JWT via
   `PortalService.getAuthenticatedContact(contact.sub)` — the exact same
   "authenticate, resolve the caller's own identity, no `@RequirePermissions`"
   shape every other `PortalXxxController` in this module already uses
   (mirrors `PortalNotificationsController` specifically, which calls the
   same method for the same reason: confirms portal access hasn't been
   revoked since the token was issued, not merely that the JWT parses).
4. **One combined `GET`, one `PATCH` per event type** — identical shape to
   `GET`/`PATCH /notification-preferences`, scoped to the two portal event
   types instead of the three agent ones.
   ```ts
   export const PORTAL_NOTIFICATION_EVENT_TYPES = ["ticket.updated", "channel.message.created"] as const;
   ```
5. **New controller lives under `apps/portal/`'s backend module
   (`apps/api/src/modules/portal/portal-notification-preferences.controller.ts`),
   not under `modules/notifications/`** — mirrors `PortalNotificationsController`'s
   own placement and "no intermediate service, inject the already-exported
   service directly" precedent exactly (`NotificationsModule` already
   exports `NotificationsService` for this exact reason; this story adds
   `PortalNotificationPreferencesService` to that same export list).
6. **Client-side filter only**, added to `PortalNotifications`
   (`apps/portal/src/components/portal/portal-notifications.tsx`) —
   fetches the caller's preferences once (`usePortalNotificationPreferencesQuery`)
   and skips calling the notifications store's `add` for a disabled event
   type, mirroring `BranchNotifications`'s identical filter exactly,
   including "while the query is loading or has failed, treat every event
   type as enabled" (a transient fetch hiccup must never silently suppress
   a real toast).
7. **A new, independent `NotificationPreferencesSection` component**,
   rendered above the existing table in `NotificationHistoryView`. Unlike
   the agent-side equivalent, the portal's notification history has no
   permission gate to stay independent of (Story 89's view is unconditional
   for any signed-in contact) — it is still its own component with its own
   query/mutation/loading/error state, for the same reason every other
   portal list view in this codebase keeps concerns in dedicated components,
   not for permission-isolation.
8. **Reuses the portal's existing `notifications.eventLabel.ticketUpdated`/
   `eventLabel.newReply` i18n keys** for each row's label — the same
   mapping `NotificationToaster`/`NotificationHistoryView` already apply —
   rather than declaring new per-event-type keys (Story 89's own precedent
   for the History columns).

## Context — Read These Files First

1. `apps/api/src/modules/notifications/{notification-preferences.service,notification-preferences.controller,dto/update-notification-preference.dto}.ts` —
   the exact shape this story ports.
2. `apps/api/src/modules/portal/{portal-notifications.controller,portal.module,portal.service}.ts` —
   the exact "`@PortalRoute()`, `getAuthenticatedContact`, inject the
   already-exported service directly" placement/pattern this story's new
   controller follows.
3. `apps/api/prisma/schema.prisma` — `NotificationPreference` (the model
   being ported, untouched by this story), `ContactRefreshToken` (the
   "separate table, not a widened shared one" precedent this story's new
   model follows), `NotificationLog`'s `customerId`/`Customer` cross-schema
   FK (the pattern this story's `contactId`/`Contact` FK mirrors).
4. `apps/api/src/modules/notifications/notifications.module.ts` — the
   module this story's new service/controller are added to and exported
   from.
5. `apps/portal/src/hooks/use-portal-notifications.ts` +
   `apps/portal/src/components/portal/portal-notifications.tsx` — the
   exact mount point this story's client-side filter is added to.
6. `apps/web/src/components/notifications/{branch-notifications,notification-preferences-section}.tsx` +
   `apps/web/src/hooks/use-notification-preferences.ts` +
   `apps/web/src/lib/notification-preferences-api.ts` — the exact
   frontend files/shape this story's portal counterparts mirror.
7. `apps/portal/src/components/portal/notification-history-view.tsx` — the
   page the new Preferences section is rendered on.
8. `apps/portal/messages/{en,ar}.json` — the existing `notifications`
   namespace this story extends.

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — add `PortalNotificationPreference`
   (Design decision 1) and the back-relation on `Contact`.
2. **Migration** — generated via `prisma migrate dev`.
3. **New `apps/api/src/modules/notifications/dto/update-portal-notification-preference.dto.ts`** —
   `eventType` (`@IsIn(PORTAL_NOTIFICATION_EVENT_TYPES)`), `inAppEnabled`
   (`@IsBoolean()`).
4. **New `apps/api/src/modules/notifications/portal-notification-preferences.service.ts`** —
   `PORTAL_NOTIFICATION_EVENT_TYPES` const array; `PortalNotificationPreferenceSummary`
   interface; `listPreferences(contactId)` (always two rows, missing ones
   defaulted `true`); `setPreference(contactId, dto)` (upsert on
   `contactId_eventType`).
5. **New `apps/api/src/modules/portal/portal-notification-preferences.controller.ts`** —
   `@Controller("portal/notification-preferences")`, `@PortalRoute()` on
   `GET`/`PATCH`, both resolving `contact.sub` through
   `PortalService.getAuthenticatedContact` first.
6. **`apps/api/src/modules/notifications/notifications.module.ts`** — add
   the new service as a provider and export it.
7. **`apps/api/src/modules/portal/portal.module.ts`** — import
   `NotificationsModule`'s newly-exported service is already imported
   (module already imports `NotificationsModule`); add the new controller
   to `controllers`.
8. **Tests** — see Test Plan.

### Frontend

9. **New `apps/portal/src/lib/notification-preferences-api.ts`** — own
   file: `PortalNotificationPreferenceSummary` type +
   `listMyNotificationPreferences`/`updateMyNotificationPreference`.
10. **New `apps/portal/src/hooks/use-portal-notification-preferences.ts`** —
    `usePortalNotificationPreferencesQuery`,
    `useUpdatePortalNotificationPreferenceMutation`.
11. **`apps/portal/src/components/portal/portal-notifications.tsx`** — read
    preferences via the new query; skip `add` for a disabled event type
    (default to enabled while loading/erroring).
12. **New `apps/portal/src/components/portal/notification-preferences-section.tsx`** —
    two toggle rows (plain Tailwind, no shared UI library in `apps/portal`),
    independent loading/error/populated state.
13. **`apps/portal/src/components/portal/notification-history-view.tsx`** —
    render the new section above the existing table.
14. **i18n** — `apps/portal/messages/{en,ar}.json`: new keys under the
    existing `notifications` namespace (`preferences.*`, mirroring
    `apps/web`'s `notificationHistory.preferences.*` text).
15. **Tests** — see Test Plan.

## API contract

- `GET /portal/notification-preferences` — `@PortalRoute()` (customer
  audience only), self-scoped — always exactly two rows
  `{ eventType, inAppEnabled }`, defaulting a missing row to `true`.
- `PATCH /portal/notification-preferences` — `@PortalRoute()`, self-scoped —
  body `{ eventType, inAppEnabled }` — upserts; 400 for an unrecognized
  `eventType`.

## Tests

**Backend unit** (new `portal-notification-preferences.service.spec.ts`):
defaults missing rows to `true`; upsert create vs. update path; rejects an
unknown `eventType`.

**Backend e2e** (new `portal-notification-preferences.e2e-spec.ts`): 401
unauthenticated; 401 for an agent-audience token (mirrors
`portal-notifications.e2e-spec.ts`'s own audience-rejection test); defaults
to all-enabled for a brand-new contact; a real `PATCH` persists and is
reflected on the next `GET`; one contact's preference never leaks to
another contact's.

**Frontend component**:
`notification-preferences-section.spec.tsx` (loading/error/toggle),
`portal-notifications.spec.tsx` extended (a disabled event type's incoming
socket payload is never forwarded to the store),
`notification-history-view.spec.tsx` extended (renders the new section).

## Regression requirements

Every existing test suite remains green, unweakened. `NotificationPreference`
(Story 58) and every agent-facing route/component are untouched.

## Migration requirements

One migration: new `portal_notification_preferences` table. No existing
table altered.

## Security risks/mitigations

- **No cross-contact leakage**: every query/mutation scoped by the
  authenticated contact's own id, never a client-supplied id.
- **No cross-audience leakage**: `@PortalRoute()` rejects an agent-audience
  token with 401, identical to every other portal route.
- **Self-scoped, no permission needed**: mirrors `GET /notification-preferences`'s
  own precedent exactly.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `PortalNotificationPreference` exists, migration applied;
      `NotificationPreference` untouched.
- [ ] `GET`/`PATCH /portal/notification-preferences` exist, self-scoped, no
      cross-contact leakage, reject an agent-audience token.
- [ ] Disabling an event type suppresses only that live toast, for that
      contact only, on the next real socket event.
- [ ] New Preferences section renders on the notification history page.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains
      green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short`
      clean before commit.

---

## Non-Goals (explicit, recap)

- Server-side per-recipient delivery targeting; `NotificationLog`/history
  filtering; email/SMS/push channel preferences; notification templates for
  the portal; "mark as read"/unread state; any change to `NotificationPreference`
  or agent-facing behavior.
- Any README change.
