> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/notification-read-state/notification-read-state/intake.md`

---

## Feature

- **Feature name (display):** Notification Read-State (Unread Count + Mark as Read)
- **Feature slug (folder under `plans/`):** `notification-read-state`

## Title

```text
Story 92 — Notification Read-State (Unread Count + Mark as Read)
```

## Description

```text
Notification Read-State was named as a real, undone gap in four
consecutive prior plan docs (Stories 88, 89, 90, 91) and declined each
time only because a more directly dependency-correct catch-up candidate
existed that round. All of those candidates are now shipped, and a fresh,
whole-repository Recon found no candidate that outranks it. This story
gives an agent and a portal customer an unread count and a "mark as read"
action over the already-shipped GET /notifications / GET
/portal/notifications history views.

Recon found NotificationLog rows are shared across recipients — agent
rows by branch, portal rows by customer — not per-user. This story
therefore does NOT add NotificationLog.isRead/readAt; it adds a
per-recipient "read up to" cursor instead: User.notificationsReadAt
(agent) and Contact.notificationsReadAt (portal, since Contact — not
Customer — is the actual authenticated per-login identity). Unread count
is computed as NotificationLog rows newer than the caller's own cursor;
mark-as-read advances that caller's own cursor to now. Two new routes per
surface (GET .../unread-count, PATCH .../read-state), gated by the
existing notification:read permission on the agent side and by
@PortalRoute() only on the portal side (no new permission is minted; no
new table is created).
```

## Acceptance criteria

```text
- [ ] User gains notificationsReadAt DateTime? (identity schema); Contact
      gains notificationsReadAt DateTime? (customers schema). One
      migration, both columns nullable, no NotificationLog change.
- [ ] GET /notifications/unread-count and PATCH /notifications/read-state
      exist on NotificationsController, gated by notification:read,
      scoped through TenantContext exactly like listNotifications().
- [ ] GET /portal/notifications/unread-count and
      PATCH /portal/notifications/read-state exist on
      PortalNotificationsController, gated by @PortalRoute() only,
      resolving the caller through PortalService.getAuthenticatedContact
      exactly like the existing list() route.
- [ ] Unread count is 0 for a cursor at "now" or later, includes every
      matching row when the cursor is null, and reuses
      listNotifications()'s/listNotificationsForCustomer()'s exact
      branch/customer scoping predicate (including nullable
      NotificationLog.branchId rows).
- [ ] apps/web's NotificationHistoryView and apps/portal's
      notification-history-view.tsx both call mark-as-read once on a
      successful mount; a 403'd list query never triggers it.
- [ ] apps/web's WorkspaceNav and apps/portal's PortalHeader both render an
      unread-count badge next to their existing "notifications" nav link,
      hidden at 0 or while loading/erroring.
- [ ] New/extended unit tests (notifications.service.spec.ts) and e2e
      tests (new notification-read-state.e2e-spec.ts, extended
      portal-notifications.e2e-spec.ts) cover: 401/403, count
      increases/resets, a null-cursor recipient sees everything unread,
      and — the critical isolation case — one agent/contact marking read
      never changes a different agent/contact's own unread count.
- [ ] pnpm --filter @crm/api test, pnpm --filter @crm/api test:e2e (or its
      documented isolated-file fallback), pnpm --filter @crm/web test,
      pnpm --filter @crm/portal test, pnpm typecheck, pnpm lint, and pnpm
      build all pass.
```

## Dependencies

- Story 22/36 — `in-app-notification-delivery` (`NotificationLog`,
  `NotificationsService.listNotifications`'s exact branch-scoping
  predicate this story's unread-count query reuses).
- Story 88 — `customer-portal-notification-history`
  (`PortalNotificationsController`, `NotificationLog.customerId`,
  `listNotificationsForCustomer`).
- Story 58/90 — `notification-preferences` /
  `customer-portal-notification-preferences` (the exact self-scoped,
  no-`TenantContext`/no-permission-on-portal controller shape this story's
  mark-as-read routes mirror).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- `NotificationLog.isRead`/`readAt` — rejected on architectural grounds
  (shared-recipient rows; see Description).
- Any per-notification read/unread join table or per-item read UI.
- Realtime unread-count push over Socket.IO.
- Any change to the transient toaster (`BranchNotifications`/portal
  `NotificationToaster`) — Story 24's non-goal stays intact.
- Notification templates, notification preferences.
- Pagination of `GET /notifications`/`GET /portal/notifications` — a real,
  separate, lower-priority gap.
- A new permission catalog entry — the agent routes reuse `notification:read`;
  the portal routes use no permission at all, matching every existing
  portal notifications route.
