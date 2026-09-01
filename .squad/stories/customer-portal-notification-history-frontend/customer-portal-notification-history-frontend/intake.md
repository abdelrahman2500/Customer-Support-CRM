> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/customer-portal-notification-history-frontend/customer-portal-notification-history-frontend/intake.md`

---

## Feature

- **Feature name (display):** Notifications / Customer Portal
- **Feature slug (folder under `plans/`):** `customer-portal-notification-history-frontend`

## Title

```text
Story 89 — Customer Portal: Notification History (Frontend)
```

## Description

```text
Story 88 added GET /portal/notifications (a persisted, read-only history
of a customer's own ticket.updated and agent-reply channel.message.created
notifications) but explicitly deferred building any apps/portal frontend
surface for it, mirroring the agent side's own precedent (Story 36 shipped
GET /notifications backend-only; Story 39 added its frontend later, as a
separate story). Since Story 88 shipped, the endpoint has had zero
consumers anywhere in this repository. This story closes that gap: a new
/[locale]/notifications route under the portal's authenticated (customer)
layout, a fourth PortalHeader nav link to it, and a plain-Tailwind
read-only history view mirroring apps/web's equivalent
NotificationHistoryView (minus its agent-only preferences/templates
sections, which have no portal equivalent).
```

## Acceptance criteria

```text
- [ ] New apps/portal/src/lib/notifications-api.ts exports
      PortalNotificationSummary and listMyNotifications(), calling
      GET /portal/notifications via the existing apiFetch client.
- [ ] New apps/portal/src/hooks/use-portal-notification-history.ts exports
      useMyNotificationsQuery() (distinct file from the existing Story 86
      realtime use-portal-notifications.ts hook, which is untouched).
- [ ] New apps/portal/src/components/portal/notification-history-view.tsx
      renders loading/error+retry/empty/populated states; maps eventType
      to the existing notifications.eventLabel.ticketUpdated/newReply i18n
      keys; resolves a row's ticket subject from the existing
      useMyTicketsQuery() cache, falling back to the raw ticketId;
      clicking a row navigates to that ticket's detail page.
- [ ] New apps/portal/src/app/[locale]/(customer)/notifications/page.tsx
      renders it, inheriting the (customer) layout's existing auth guard.
- [ ] PortalHeader gains a fourth nav link to /{locale}/notifications,
      appended after the existing tickets/knowledge-base/chat links.
- [ ] apps/portal/messages/en.json and ar.json both gain a
      notifications.nav key and a notifications.history sub-object
      (title/error/retry/empty/columns.*), with no existing key modified.
- [ ] New notification-history-view.spec.tsx covers all four view states
      plus ticket-subject resolution/fallback and row-click navigation.
- [ ] No apps/api file is touched; no backend behavior changes.
- [ ] pnpm --filter @crm/portal test, pnpm typecheck, pnpm lint, and
      pnpm build all pass.
```

## Dependencies

- Story 88 — `customer-portal-notification-history`
  (`GET /portal/notifications`, `NotificationSummary`).
- Story 53 — `customer-portal-ticket-submission-tracking`
  (`useMyTicketsQuery`, the `tickets-api.ts`/`use-portal-tickets.ts`/
  `ticket-list-view.tsx` three-file split this story's new files mirror).
- Story 39 (unplanned, `.squad/plans/00-index.md`'s Stories 38-40 row) —
  `apps/web`'s equivalent `notifications-api.ts`/`use-notifications.ts`/
  `notification-history-view.tsx`.
- Story 86 — `customer-portal-notification-delivery` (`PortalHeader`'s
  nav-link convention, the existing `notifications` i18n namespace and its
  `eventLabel.*` keys this story reuses rather than re-declares).

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Any notification-preferences UI for the portal.
- Any notification-templates UI for the portal.
- "Mark as read"/unread-count/badge state.
- Any realtime/live merge with the existing Story 86 toaster — this is a
  separate, on-demand `GET`-backed history view.
- Pagination.
- Any `apps/api` backend change.
