# Story 89 — Customer Portal: Notification History (Frontend)

## Prerequisites

- `customer-portal-notification-history` Story 88 —
  `apps/api/src/modules/portal/portal-notifications.controller.ts`
  (`GET /portal/notifications`, `@PortalRoute()`),
  `apps/api/src/modules/notifications/notifications.service.ts`
  (`NotificationSummary`, `listNotificationsForCustomer`). Both complete,
  merged, untouched by this story.
- `customer-portal-ticket-submission-tracking` Story 53 —
  `apps/portal/src/lib/tickets-api.ts` /
  `apps/portal/src/hooks/use-portal-tickets.ts` /
  `apps/portal/src/components/tickets/ticket-list-view.tsx` (the
  API-client / query-hook / plain-Tailwind-view three-file split this
  story's new files mirror exactly).
- `agent-workspace-user-admin` follow-up Story 39 (`_(unplanned)_` row in
  `.squad/plans/00-index.md`) — `apps/web/src/lib/notifications-api.ts` /
  `apps/web/src/hooks/use-notifications.ts` /
  `apps/web/src/components/notifications/notification-history-view.tsx`
  (the equivalent agent-side history view this story's portal counterpart
  mirrors, minus the agent-only preferences/templates sections — see
  Non-Goals).
- `customer-portal-notification-delivery` Story 86 —
  `apps/portal/src/components/portal/portal-header.tsx` (nav-link
  convention), `apps/portal/messages/{en,ar}.json`'s existing
  `notifications` namespace (`eventLabel.ticketUpdated`/`eventLabel.
  newReply`, reused verbatim rather than re-declared — see design decision
  3).

All are complete and already merged to `main`.

## Story Goal

Give the Customer Portal a real page for `GET /portal/notifications`
(Story 88), which has had zero frontend consumer since it shipped:

1. A new `/[locale]/notifications` route under the authenticated
   `(customer)` layout renders a read-only history of the signed-in
   customer's own notifications (`ticket.updated` and agent-reply
   `channel.message.created` rows), newest first.
2. `PortalHeader` gains a fourth nav link to it, alongside
   `tickets`/`knowledge-base`/`chat`.
3. Each row shows an event label, a link to the related ticket (resolved
   against the customer's own already-fetched ticket list when possible,
   falling back to the raw ticket id), and the logged-at timestamp.

## Non-Goals

- **No notification-preferences UI for the portal.** Mirrors Story 88's own
  deferral — `NotificationPreference` (agent-side Story 58) has no portal
  equivalent yet; inventing one is a separate, later story.
- **No notification-templates UI for the portal.** `NotificationTemplate`
  (Story 61) is a branch-admin authoring resource, unrelated to a customer
  reading their own history; `apps/web`'s `NotificationHistoryView` renders
  a template's substituted text when one exists purely because branch
  admins can create them — no portal equivalent exists to render.
- **No "mark as read"/unread-count/badge state.** `NotificationLog` has no
  such column (confirmed at Story 88); this story's list is a plain,
  always-fully-shown history, matching `apps/web`'s own equivalent view.
- **No realtime merge with the existing live toaster.** Story 86's
  `NotificationToaster`/`usePortalNotifications` socket subscription is
  untouched; this new page is a separate, on-demand `GET`-backed view, not
  a live feed. A notification a customer already saw as a toast simply
  also appears here once persisted (Story 88 already guarantees that).
- **No pagination.** Mirrors `GET /portal/notifications` itself (Story 88
  added no pagination parameters) and `apps/web`'s equivalent view.
- **No backend change of any kind.** `GET /portal/notifications` is
  consumed exactly as Story 88 shipped it.

## Design decisions

1. **New API client file, `apps/portal/src/lib/notifications-api.ts`**
   (mirrors `apps/web/src/lib/notifications-api.ts` file-for-file, and this
   codebase's established "own domain, no forced coupling to
   `tickets-api.ts`" convention already used by `branding-api.ts`/
   `knowledge-base-api.ts`/`chat-api.ts` in this same directory). Declares
   its own `PortalNotificationSummary` interface — an independent
   per-app re-declaration of the backend's `NotificationSummary`, matching
   this file's existing sibling files' convention (`PortalTicketSummary`,
   `ChannelMessageSummary`, etc. are all independently re-declared, never
   imported from `@crm/shared`) — with `targetAt`/`loggedAt` typed as
   `string` (ISO, over-the-wire), not `Date`, same as every other
   timestamp field in this codebase's frontend clients.
   ```ts
   export interface PortalNotificationSummary {
     id: string;
     eventType: string;
     ticketId: string;
     branchId: string | null;
     targetType: string | null;
     targetAt: string | null;
     loggedAt: string;
   }

   export function listMyNotifications(): Promise<PortalNotificationSummary[]> {
     return apiFetch<PortalNotificationSummary[]>("/portal/notifications");
   }
   ```
2. **New hook file, `apps/portal/src/hooks/use-portal-notification-history.ts`**
   (a distinct file from the existing `use-portal-notifications.ts`, which
   is Story 86's realtime *socket* hook — same name prefix, different
   concern, so this story does not touch or rename that file). Mirrors
   `apps/web/src/hooks/use-notifications.ts`'s "own file, no `staleTime`
   override, re-fetches like any other list" convention exactly:
   ```ts
   export const myNotificationsQueryKey = ["portal-notifications"] as const;

   export function useMyNotificationsQuery() {
     return useQuery({ queryKey: myNotificationsQueryKey, queryFn: listMyNotifications });
   }
   ```
3. **New view component,
   `apps/portal/src/components/portal/notification-history-view.tsx`**,
   plain HTML/Tailwind (no shared UI component library exists in
   `apps/portal` — Story 52 precedent, reconfirmed by `TicketListView`/
   `KnowledgeBaseListView`), following the loading-skeleton /
   error-with-retry / empty / populated-list shape every other portal list
   view already uses. Reuses the portal's *existing* `notifications` i18n
   namespace's `eventLabel.ticketUpdated`/`eventLabel.newReply` keys
   verbatim (the exact same mapping `NotificationToaster` already applies:
   `eventType === "ticket.updated" ? "eventLabel.ticketUpdated" :
   "eventLabel.newReply"`) rather than declaring new event-label keys —
   Story 88 guarantees `eventType` is always one of exactly those two
   strings for portal-scoped rows, so no third branch/fallback is needed.
   Ticket-subject resolution reuses the already-fetched, already-cached
   `useMyTicketsQuery()` (Story 53) the same client-side-join way
   `apps/web`'s `NotificationHistoryView` resolves against its own
   `useTicketsQuery({})` — no new backend parameter, and
   `use-portal-tickets.ts` is not modified. A ticket the customer's own
   ticket list doesn't (yet) contain falls back to the raw `ticketId`,
   same fallback convention as the agent-side view.
   Columns: Event | Ticket | Logged At (no Customer column — the portal is
   inherently single-customer-scoped; no Target column — Story 88's own
   doc comment confirms `targetType`/`targetAt` are always `null` for
   customer-scoped rows, so rendering that column would be dead weight
   never once populated).
4. **New route, `apps/portal/src/app/[locale]/(customer)/notifications/page.tsx`**
   — a one-line page mirroring every other portal route
   (`tickets/page.tsx`, `knowledge-base/page.tsx`): `export default
   function NotificationsPage() { return <NotificationHistoryView />; }`.
   Inherits the `(customer)` layout's existing server-side auth guard
   (Story 52) automatically — no new guard code needed.
5. **`PortalHeader` gains a fourth nav link**, `/${locale}/notifications`,
   placed after the existing `chat` link (append-only, matching how each
   prior story added its own link — Story 53 tickets, Story 54 knowledge
   base, Story 80 chat — without reordering the existing ones). Uses a new
   `notifications.nav` i18n key (the existing `notifications` namespace
   currently has no `nav` key — the toaster never needed one).
6. **i18n**: extend the existing `notifications` namespace in both
   `apps/portal/messages/en.json` and `apps/portal/messages/ar.json` with a
   `nav` key and a new `history` sub-object (`title`, `error`, `retry`,
   `empty`, `columns.event`, `columns.ticket`, `columns.loggedAt`) —
   mirrors `tickets`'s existing `nav` + `list`/`detail` sub-object
   convention in the same file. No existing key in either file is
   modified.

## Context — Read These Files First

- `apps/api/src/modules/portal/portal-notifications.controller.ts` /
  `apps/api/src/modules/notifications/notifications.service.ts` — the
  exact response shape (`NotificationSummary[]`) and auth requirement
  (`@PortalRoute()`, no extra permission check) this story's client
  consumes.
- `apps/portal/src/lib/tickets-api.ts` / `apps/portal/src/hooks/
  use-portal-tickets.ts` / `apps/portal/src/components/tickets/
  ticket-list-view.tsx` — the three-file split and plain-Tailwind
  loading/error/empty/populated shape this story's three new files mirror.
- `apps/web/src/lib/notifications-api.ts` / `apps/web/src/hooks/
  use-notifications.ts` / `apps/web/src/components/notifications/
  notification-history-view.tsx` — the equivalent agent-side
  implementation this story's portal counterpart mirrors (minus the
  agent-only preferences/templates sections and the Customer/Target
  columns, which have no portal equivalent — see Non-Goals/design decision
  3).
- `apps/portal/src/components/portal/notification-toaster.tsx` — the
  existing `eventType === "ticket.updated" ? ... : ...` event-label
  mapping and the existing `notifications` i18n namespace this story
  extends rather than duplicates.
- `apps/portal/src/components/portal/portal-header.tsx` — the exact
  append-only nav-link pattern this story's fourth link follows.
- `apps/portal/src/app/[locale]/(customer)/layout.tsx` — confirms every
  route under `(customer)/` is already guarded server-side; the new page
  needs no guard code of its own.
- `apps/portal/messages/en.json` / `apps/portal/messages/ar.json` — the
  existing `notifications` namespace this story extends, and the
  `tickets.nav` + `tickets.list`/`tickets.detail` nesting convention the
  new `notifications.nav`/`notifications.history` keys mirror.

## Frontend Tasks

1. **`apps/portal/src/lib/notifications-api.ts`** (new) — per design
   decision 1.
2. **`apps/portal/src/hooks/use-portal-notification-history.ts`** (new) —
   per design decision 2.
3. **`apps/portal/src/components/portal/notification-history-view.tsx`**
   (new) — per design decision 3.
4. **`apps/portal/src/app/[locale]/(customer)/notifications/page.tsx`**
   (new) — per design decision 4.
5. **`apps/portal/src/components/portal/portal-header.tsx`** — add the
   fourth nav link, per design decision 5.
6. **`apps/portal/messages/en.json` / `apps/portal/messages/ar.json`** —
   extend the `notifications` namespace, per design decision 6.

## Test Plan

1. **`apps/portal/src/components/portal/notification-history-view.spec.tsx`**
   (new) — mirrors `notification-history-view.spec.tsx` (`apps/web`) and
   `ticket-list-view.spec.tsx` (`apps/portal`)'s own mocking conventions:
   loading skeleton while pending; error state with a working retry action;
   empty state on an empty success result; renders one row per
   notification in the exact order the query returned (no client-side
   re-sort); resolves a ticket's subject from a mocked
   `useMyTicketsQuery()` result when present, falls back to the raw
   `ticketId` when the ticket isn't in that list; maps `ticket.updated` /
   `channel.message.created` to the correct existing `eventLabel.*`
   translation key; clicking a row's ticket link navigates to
   `/{locale}/tickets/{ticketId}`.
2. **`apps/portal/src/components/portal/portal-header.tsx`** — extend its
   existing spec (if one exists) or add coverage confirming the new
   `notifications` link renders with the correct `href`; if no header spec
   currently exists, this task is skipped without inventing new,
   unrelated test infrastructure (confirmed during implementation).

## Migration / Rollback

- **No backend change, no migration.** Purely additive frontend files plus
  two i18n-file edits and one existing-component edit
  (`portal-header.tsx`'s new nav link).
- **Rollback**: delete the four new files, revert `portal-header.tsx`'s
  added link, revert the two `messages/*.json` additions. No other file is
  touched.

## Verification Steps

1. `pnpm --filter @crm/portal test`
2. `pnpm typecheck && pnpm lint && pnpm build`
3. `git status --short`

(No `apps/api` changes in this story, so no backend unit/e2e suite is
expected to be affected — `pnpm --filter @crm/api test`/`test:e2e` are not
part of this story's own verification scope, though CI still runs them
across the whole monorepo.)

## Done Criteria

- [ ] `GET /portal/notifications` has a real, reachable frontend consumer:
      a new `/[locale]/notifications` route under `(customer)` renders the
      signed-in customer's own notification history, newest first.
- [ ] `PortalHeader` links to it, alongside the existing
      tickets/knowledge-base/chat links.
- [ ] Loading, error+retry, empty, and populated states all render
      correctly; a row's ticket link resolves the subject when available
      and falls back to the raw ticket id otherwise; clicking it navigates
      to that ticket's detail page.
- [ ] Both `en.json` and `ar.json` gain the new keys with no existing key
      modified.
- [ ] Every item in `## Test Plan` is added and passing.
- [ ] Every command in `## Verification Steps` passes.
- [ ] Every pre-existing test suite remains green, unweakened.
- [ ] No `apps/api` file is touched.
