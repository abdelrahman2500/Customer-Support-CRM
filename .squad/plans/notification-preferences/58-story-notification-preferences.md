# Story 58 — Notifications — Per-User In-App Preferences

## Prerequisites

- `in-app-notification-delivery` (Story 22/24): `BranchNotificationRealtimeListener` (the exact three event types this story's preferences govern), `useBranchNotifications`/`BranchNotifications` (the exact client mount point this story's filter is added to).

---

## Story Goal

Let each agent turn off the live in-app toast for any of the three branch-wide notification event types (`sla.at_risk`, `sla.breached`, `ticket.escalated`) for themselves, without affecting any other agent. Closes `docs/architecture/03-domain-boundaries.md`'s Notifications row's still-unaddressed "per-user preferences."

**Not in scope**: server-side per-recipient delivery targeting (the existing branch-wide broadcast is unchanged — see the plan overview's dependency note); preferences for `NotificationLog`/history visibility (unaffected — governed only by the existing `notification:read` permission); email/SMS/push channel preferences (no such channel exists yet); notification templates.

---

## Context — Read These Files First

1. `apps/api/src/realtime/branch-notification-realtime-listener.ts` — the exact three event constants (`SLA_AT_RISK_EVENT`/`SLA_BREACHED_EVENT`/`TICKET_ESCALATED_EVENT`) this story's preference rows govern; confirms the broadcast is branch-wide with no recipient resolution (the basis for this story's scope boundary).
2. `apps/api/src/modules/identity/identity.controller.ts` — `GET /auth/me`'s exact "authenticated, no `@RequirePermissions`, `request.user.sub` self-scoping" shape this story's new controller mirrors (a preference is the requesting user's own, never an admin resource).
3. `apps/api/src/modules/notifications/{notifications.controller,notifications.service,notifications.module}.ts` — the module this story's new controller/service are added to (mirrors the "grow this module per schema" convention already used by `SlaPoliciesModule`/`TicketsModule`).
4. `apps/web/src/hooks/use-branch-notifications.ts` + `apps/web/src/components/notifications/branch-notifications.tsx` — the exact mount point (`BranchNotifications`) where this story's client-side filter is added, before forwarding an incoming event to the Zustand store's `add`.
5. `apps/web/src/components/notifications/notification-history-view.tsx` — confirms this screen is gated by `notification:read` (a plain Agent can lack it) — the reason the new Preferences section is its own, independently-rendered component on the same page, never nested inside the permission-gated history query's conditional block (a user without `notification:read` must still be able to manage their own preferences).

---

## Design decisions

1. **Absence of a row means "enabled"** — mirrors `SlaPolicy`'s own "no row/null field = unrestricted" convention; a brand-new user has nothing to migrate, every event type defaults on.
2. **No new permission** — self-scoped by `request.user.sub` (the JWT's own subject), identical to `GET /auth/me`'s existing precedent; a preference is never a branch-admin resource, so `@RequirePermissions` is deliberately absent (not an oversight).
3. **One combined `GET`, one `PATCH` per event type** — `GET /notification-preferences` always returns exactly the three known event types (defaulting missing rows to `enabled: true`), `PATCH /notification-preferences` upserts one `{ eventType, inAppEnabled }` pair. No bulk-PATCH: three independent toggles, mirroring `SlaPolicyRow`'s/`AutomationRuleRow`'s own one-field-at-a-time mutation shape.
4. **Client-side filter only** — `BranchNotifications` fetches the caller's preferences once (`useNotificationPreferencesQuery`) and skips calling the Zustand store's `add` for a disabled event type, rather than the backend withholding the socket emission per-recipient (Design decision/plan overview: the existing broadcast has no per-recipient resolution at all; adding it is separate, larger scope).
5. **A new, independent `NotificationPreferencesSection` component**, not nested inside `NotificationHistoryView`'s existing `notification:read`-gated conditional — a user lacking that permission must still be able to manage their own toast preferences (Design decision 2's self-scoping, made visible in the UI too).

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — add `NotificationPreference` (userId, eventType, inAppEnabled, `@@unique([userId, eventType])`, `notifications` schema) and the back-relation on `User`.
2. **Migration** — generated via `prisma migrate dev`.
3. **New `apps/api/src/modules/notifications/dto/update-notification-preference.dto.ts`** — `eventType` (`@IsIn(["sla.at_risk", "sla.breached", "ticket.escalated"])`), `inAppEnabled` (`@IsBoolean()`).
4. **New `apps/api/src/modules/notifications/notification-preferences.service.ts`** — `NOTIFICATION_EVENT_TYPES` const array (the same three literal strings `BranchNotificationRealtimeListener` already hardcodes); `NotificationPreferenceSummary` interface; `listPreferences(userId)` (always three rows, missing ones defaulted `true`); `setPreference(userId, dto)` (upsert on `userId_eventType`).
5. **New `apps/api/src/modules/notifications/notification-preferences.controller.ts`** — `@Controller("notification-preferences")`, `GET`/`PATCH`, both reading `request.user.sub` directly (mirrors `IdentityController.me`), no `@RequirePermissions`.
6. **`apps/api/src/modules/notifications/notifications.module.ts`** — add the new controller/service.
7. **Tests** — see Test Plan.

### Frontend

8. **New `apps/web/src/lib/notification-preferences-api.ts`** — own file: `NotificationPreferenceSummary` type + `listNotificationPreferences`/`updateNotificationPreference`.
9. **New `apps/web/src/hooks/use-notification-preferences.ts`** — `useNotificationPreferencesQuery`, `useUpdateNotificationPreferenceMutation`.
10. **`apps/web/src/components/notifications/branch-notifications.tsx`** — read preferences via the new query; skip `add` for a disabled event type (default to enabled while the query is still loading/erroring — never silently suppress toasts due to a transient fetch failure).
11. **New `apps/web/src/components/notifications/notification-preferences-section.tsx`** — three toggle rows, independent loading/error/populated state.
12. **`apps/web/src/components/notifications/notification-history-view.tsx`** — render the new section above the existing (permission-gated) history table.
13. **i18n** — `apps/web/messages/{en,ar}.json`: new keys under the existing `notificationHistory` namespace.
14. **Tests** — see Test Plan.

---

## API contract

- `GET /notification-preferences` — authenticated only, no permission — always exactly three rows `{ eventType, inAppEnabled }`, defaulting a missing row to `true`.
- `PATCH /notification-preferences` — authenticated only, no permission — body `{ eventType, inAppEnabled }` — upserts; 400 for an unrecognized `eventType`.

## Tests

**Backend unit** (new `notification-preferences.service.spec.ts`): defaults missing rows to `true`; upsert create vs. update path; rejects an unknown `eventType`.

**Backend e2e** (new `notification-preferences.e2e-spec.ts`): 401 unauthenticated; defaults to all-enabled for a brand-new user; a real `PATCH` persists and is reflected on the next `GET`; one user's preference never affects another user's.

**Frontend component**: `notification-preferences-section.spec.tsx` (loading/error/toggle), `branch-notifications.spec.tsx` extended (a disabled event type's incoming socket payload is never forwarded to the store).

## Regression requirements

Every existing test suite remains green, unweakened.

## Migration requirements

One migration: new `notification_preferences` table. No existing table altered.

## Security risks/mitigations

- **No cross-user leakage**: every query/mutation scoped by `request.user.sub`, never a client-supplied `userId`.
- **Self-scoped, no permission needed**: mirrors `GET /auth/me`'s own precedent exactly — this is intentional, not a missing permission check.

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `NotificationPreference` exists, migration applied.
- [ ] `GET`/`PATCH /notification-preferences` exist, self-scoped, no cross-user leakage.
- [ ] Disabling an event type suppresses only that live toast, for that user only, on the next real socket event.
- [ ] New Preferences section renders independent of the `notification:read`-gated history table.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Server-side per-recipient delivery targeting; `NotificationLog`/history filtering; email/SMS/push channel preferences; notification templates.
- Any README change.
