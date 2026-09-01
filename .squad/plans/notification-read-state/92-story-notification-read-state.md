# Story 92 — Notification Read-State (Unread Count + Mark as Read)

## Prerequisites

- `in-app-notification-delivery` Story 22/36 —
  `apps/api/src/modules/notifications/{notifications.service,notifications.controller}.ts`
  (`NotificationLog`, `NotificationsService.listNotifications`, the
  branch-scoping predicate this story's unread-count query reuses
  verbatim).
- `customer-portal-notification-history` Story 88 —
  `apps/api/src/modules/portal/portal-notifications.controller.ts`,
  `NotificationsService.listNotificationsForCustomer`,
  `NotificationLog.customerId`.
- `notification-preferences` Story 58 and `customer-portal-notification-preferences`
  Story 90 — `NotificationPreferencesController`/`PortalNotificationPreferencesController`
  — the exact "self-scoped by the caller's own id resolved from the JWT, no
  `TenantContext`, no `@RequirePermissions` on the portal side" controller
  shape this story's mark-as-read routes mirror.

All are complete and already merged to `main`.

## Story Goal

Give an agent and a portal customer a real "what's new since I last looked"
signal over the already-shipped `GET /notifications` /
`GET /portal/notifications` history views: an unread count, and a way to
mark everything read up to now. Closes the exact gap named as a disclosed,
undone non-goal in four consecutive prior stories (88, 89, 90, 91).

## Non-Goals

- **No `NotificationLog.isRead`/`readAt` column.** `NotificationLog` rows
  are shared across recipients (branch-wide for agents, customer-wide for
  portal contacts) — a column on the row itself would leak one recipient's
  read action onto every other recipient sharing that scope. See "Design
  decisions" below.
- **No per-notification read/unread join table.** Neither existing history
  view has ever had per-row read/unread UI; a single per-recipient "read up
  to" timestamp is sufficient and is the smaller, more dependency-correct
  increment.
- **No realtime unread-count push over Socket.IO.** The count is computed
  on demand (`GET`, on view mount/nav render); no new socket event, no
  change to `RealtimeGateway`.
- **No changes to the transient toaster** (`BranchNotifications`/
  `NotificationToaster` on either app) — Story 24's "no notification
  center, no read/unread state, no per-user inbox" non-goal for the
  *toaster* stays intact. This story only touches the on-demand history
  views and their nav entry points.
- **No notification-templates or notification-preferences changes.**
- **No pagination of `GET /notifications`/`GET /portal/notifications`.** A
  real, separate gap (see the Story 92 Recon's candidate table); not
  bundled here to keep this story's surface small and single-purpose.
- **No new permission catalog for the portal side.** The portal has no
  permission system at all (audience-only auth, `@PortalRoute()`) — every
  existing portal notifications route already follows this; the new portal
  routes do too.

## Design decisions

1. **Per-recipient "read up to" cursor, not a per-row flag.** Recon
   confirmed `NotificationsService.listNotifications()` scopes by
   `ticket.branchId` (shared by every agent in the branch) and
   `listNotificationsForCustomer()` scopes by `customerId` (shared by every
   `Contact` of that customer) — neither is a per-recipient row. The
   correct model is a single nullable timestamp on the recipient's own
   identity row, with "unread" computed as `NotificationLog.loggedAt >
   cursor` (or "everything" when the cursor is `null`, i.e. never read).

2. **The cursor lives on `User` (agent) and `Contact` (portal) — a plain
   column, not a new table.** Both are the actual authenticated recipient
   identity already resolved on every request:
   - Agent: `TenantContext.userId`, populated by `TenantMiddleware` from
     the access token's claims — the same identity every self-scoped
     agent-side resource already resolves through (mirrors
     `NotificationPreferencesController`'s `request.user.sub` /
     `TenantContext` precedent).
   - Portal: `PortalService.getAuthenticatedContact(contact.sub)` — `sub`
     is the `Contact.id` (confirmed in `PortalService.issueAccessToken`),
     **not** the `Customer.id`. This is the correct recipient identity: two
     different `Contact`s under the same `Customer` are two different
     portal logins today (`CustomersService.setContactPortalPassword` is
     per-`Contact`), so the cursor must live on `Contact`, not `Customer`,
     even though the notification rows themselves are `customerId`-scoped.
   - A plain column (not a table) is correct here specifically because
     this is a *single scalar* per recipient — unlike `NotificationPreference`/
     `PortalNotificationPreference`, which are tables because they hold
     one row *per event type* per recipient. Mirrors this codebase's own
     "add a plain column to an existing core model via migration" precedent
     (`Role.isActive`, `Branch.isActive`/`Department.isActive`) rather than
     inventing a table for data with no multiplicity.

3. **Two new routes per surface, not an envelope change to the existing
   list endpoints.**
   - `GET /notifications/unread-count` (agent, `notification:read`) /
     `GET /portal/notifications/unread-count` (portal, `@PortalRoute()`
     only) → `{ unreadCount: number }`.
   - `PATCH /notifications/read-state` (agent, `notification:read`) /
     `PATCH /portal/notifications/read-state` (portal, `@PortalRoute()`
     only) → advances the caller's own cursor to the server's current time;
     returns `{ readAt: string }`. No request body.
   - **Why not fold `unreadCount`/`isRead` into the existing list
     response**: `GET /notifications`/`GET /portal/notifications` return a
     raw array today (`notifications-read.e2e-spec.ts`'s own
     `expect(Array.isArray(response.body)).toBe(true)`); changing that to
     an envelope (`{ notifications, unreadCount }`) would be a breaking
     shape change for every existing consumer (`useNotificationsQuery`/
     `usePortalNotificationHistory` and their tests) for no benefit this
     story needs. A dedicated endpoint is strictly additive.

4. **Agent-side new routes reuse the existing `notification:read`
   permission — no new permission is minted.** Reasoning: unread count and
   mark-as-read are both meaningless without also being able to see the
   underlying list (`GET /notifications`, already gated by
   `notification:read`), and exposing an unread count to a caller who
   cannot even list notifications would leak information about a resource
   they have no access to. This satisfies "a dedicated permission, not
   overloading `notification:update`" literally — `notification:update`
   (currently only consumed by `NotificationTemplatesController`, an
   unrelated resource) is never touched — while avoiding inventing a
   third, functionally-redundant permission for a feature that is a strict
   sub-capability of an already-permissioned resource. (Recon surfaced a
   real, closer-fitting repository precedent that argues for *no*
   permission at all — `NotificationPreferencesController`'s "self-scoped,
   never a branch-admin resource, no permission" shape — but preferences
   govern the caller's own opt-in settings, not visibility into branch-wide
   `NotificationLog` data the way unread-count does; gating by
   `notification:read` is the closer-fitting precedent for *this*
   capability specifically.)

5. **Portal-side new routes take no permission at all** — `@PortalRoute()`
   only, exactly like every other portal notifications route
   (`PortalNotificationsController`/`PortalNotificationPreferencesController`).
   The portal has no permission catalog; audience-only auth is this
   codebase's only portal access-control mechanism.

6. **Unread count formula, exact**:
   ```ts
   const cursor = user.notificationsReadAt; // Date | null
   const where = {
     ticket: { branchId },
     customerId: null,
     ...(cursor ? { loggedAt: { gt: cursor } } : {}),
   };
   const unreadCount = await prisma.notificationLog.count({ where });
   ```
   identical predicate shape to `listNotifications()`'s own `where`, plus
   the cursor filter. A `null` cursor (never marked read) counts every row
   — "unread" defaults to true for anything the recipient has never
   acknowledged. Portal mirrors this exactly, substituting
   `customerId: authenticated.customerId` for the branch/ticket predicate
   (no `ticket` relation needed, matching `listNotificationsForCustomer`'s
   own simpler `where`).

7. **Mark-as-read always advances to server `now`** — no client-supplied
   timestamp, no per-item id list. Simplest correct semantics given no
   per-item read UI exists on either history view (Non-Goals): opening the
   history view marks everything visible (and everything that ever will
   exist up to this instant) as read.

## Context — Read These Files First

1. `apps/api/prisma/schema.prisma` — `User`, `Contact`, `NotificationLog`
   models (the two recipient models this story adds a column to, and the
   shared-scope table whose rows are counted against that column).
2. `apps/api/src/modules/notifications/{notifications.service,notifications.controller}.ts`
   — the exact `where` predicate this story's unread-count query must
   reuse for the agent side.
3. `apps/api/src/modules/portal/portal-notifications.controller.ts` and
   `apps/api/src/modules/portal/portal.service.ts`'s `getAuthenticatedContact`
   — the exact contact-resolution shape this story's portal routes reuse.
4. `apps/api/src/modules/notifications/{notification-preferences.controller,notification-preferences.service}.ts`
   and `apps/api/src/modules/portal/portal-notification-preferences.controller.ts`
   — the exact "self-scoped by the caller's own id, `@Patch()` with no id
   param" controller shape this story's mark-as-read routes mirror.
5. `apps/api/src/common/tenant/tenant-context.ts` — `TenantContext.userId`/
   `requireBranchScope()`.
6. `apps/api/prisma/migrations/20260829090000_add_role_is_active/migration.sql`
   — the exact "add one plain nullable/defaulted column to an existing
   table" migration shape this story's migration mirrors.
7. `apps/web/src/components/workspace/workspace-nav.tsx` and
   `apps/portal/src/components/portal/portal-header.tsx` — the nav
   components this story's unread badge attaches to.
8. `apps/web/src/hooks/use-notifications.ts` +
   `apps/web/src/components/notifications/notification-history-view.tsx`,
   and their portal equivalents (`use-portal-notification-history.ts` +
   `notification-history-view.tsx` under `apps/portal`) — the views that
   trigger mark-as-read on mount.
9. `apps/api/test/notifications-read.e2e-spec.ts` and
   `apps/api/test/portal-notifications.e2e-spec.ts` — the e2e bootstrap
   shape this story's own new specs mirror.

## Backend Tasks

1. **`apps/api/prisma/schema.prisma`**:
   - `User` gains `notificationsReadAt DateTime? @map("notifications_read_at")`.
   - `Contact` gains `notificationsReadAt DateTime? @map("notifications_read_at")`.
2. **One migration** (`prisma migrate dev`) — two `ALTER TABLE ... ADD
   COLUMN` statements (`identity.users`, `customers.contacts`), both
   nullable, no default backfill needed (mirrors the `add_role_is_active`/
   `add_branch_department_is_active...` migrations' shape of touching more
   than one table in a single migration when the change is the same kind
   of edit).
3. **`apps/api/src/modules/notifications/notifications.service.ts`** —
   add:
   - `async getUnreadCount(): Promise<{ unreadCount: number }>` — agent
     side, `TenantContext.userId` + `requireBranchScope()`, formula in
     Design decision 6.
   - `async markRead(): Promise<{ readAt: Date }>` — agent side,
     `prisma.user.update({ where: { id: userId }, data: { notificationsReadAt: new Date() } })`.
   - `async getUnreadCountForCustomer(contactId: string, customerId: string): Promise<{ unreadCount: number }>`
     and `async markReadForContact(contactId: string): Promise<{ readAt: Date }>`
     — portal side, mirroring `listNotificationsForCustomer`'s existing
     "no `ticket` relation needed" simplicity; cursor read from/written to
     `Contact`, count filtered by `customerId`.
4. **`apps/api/src/modules/notifications/notifications.controller.ts`** —
   add `@Get("unread-count")` and `@Patch("read-state")`, both
   `@RequirePermissions("notification:read")`, both resolving the caller's
   `userId` from `TenantContext` (already injected).
5. **`apps/api/src/modules/portal/portal-notifications.controller.ts`** —
   add `@Get("unread-count")` and `@Patch("read-state")`, both
   `@PortalRoute()` only, resolving the caller through
   `portalService.getAuthenticatedContact(contact.sub)` exactly like the
   existing `list()` method.
6. No DTO files needed — both mutation routes take no request body.
7. No `notifications.module.ts` changes beyond what already provides
   `TenantContext`/`NotificationsService` to both controllers (both are
   already wired for Story 36/88).

## Frontend Tasks — Agent Workspace (`apps/web`)

8. **`apps/web/src/lib/notifications-api.ts`** — add
   `getUnreadNotificationCount(): Promise<{ unreadCount: number }>` and
   `markNotificationsRead(): Promise<{ readAt: string }>`, mirroring the
   file's existing `listNotifications` shape exactly.
9. **`apps/web/src/hooks/use-notifications.ts`** — add
   `useUnreadNotificationCountQuery()` (own query key,
   `["notifications", "unread-count"]`) and
   `useMarkNotificationsReadMutation()` (invalidates the unread-count query
   key on success — mirrors `use-notification-preferences.ts`'s own
   mutation/invalidate shape).
10. **`apps/web/src/components/notifications/notification-history-view.tsx`**
    — on mount (a `useEffect` after `notificationsQuery` succeeds, gated on
    the caller actually holding `notification:read` — i.e. only when the
    list itself didn't 403), fire the mark-as-read mutation once.
11. **`apps/web/src/components/workspace/workspace-nav.tsx`** — the
    `notifications` `NAV_ITEMS` entry renders `useUnreadNotificationCountQuery()`'s
    count as a small `Badge` (reuse `@/components/ui/badge`, already
    imported elsewhere) next to the link text when `> 0`; a loading/errored
    query renders no badge (never blocks the link itself — mirrors this
    codebase's own "a fetch hiccup never breaks the primary flow"
    convention used throughout, e.g. `ChatComposer`'s quick-reply picker).

## Frontend Tasks — Customer Portal (`apps/portal`)

12. **`apps/portal/src/lib/notifications-api.ts`** — add
    `getUnreadNotificationCount`/`markNotificationsRead`, mirroring
    `apps/web`'s new functions (independent re-declaration, same
    convention as `PortalNotificationSummary`).
13. **`apps/portal/src/hooks/use-portal-notification-history.ts`** (or a
    new adjacent hook file, matching whichever the existing file's shape
    favors) — add the portal equivalents of Task 9's two hooks.
14. **`apps/portal/src/components/portal/notification-history-view.tsx`**
    — same on-mount mark-as-read trigger as Task 10.
15. **`apps/portal/src/components/portal/portal-header.tsx`** — the
    existing `notifications` nav link gains the same `Badge`-based unread
    count treatment as Task 11.

## i18n

16. `apps/web/messages/{en,ar}.json` and
    `apps/portal/messages/{en,ar}.json` — no new translated strings are
    strictly required (a numeric badge needs no copy), but if an
    `aria-label`/screen-reader string is added for the badge
    (`workspace.nav.unreadNotificationsLabel` / portal equivalent, e.g. "3
    unread notifications"), it is added to all four files, mirroring every
    prior story's "both locales together, no existing key modified"
    convention.

## Edge Cases & Failure Modes

- **Unauthenticated request**: `401` on both new routes per surface,
  identical to every other protected/portal route.
- **Agent lacking `notification:read`**: `403` on both new agent routes —
  mirrors the existing `GET /notifications` behavior exactly (an agent who
  cannot list notifications cannot see or affect their count either).
- **Cursor is `null` (never read)**: unread count includes every row for
  that recipient's scope (Design decision 6) — never treated as "0 unread"
  or as an error.
- **Nullable `NotificationLog.branchId`** (`ticket.escalated` rows): unread
  count reuses `listNotifications()`'s exact `ticket: { branchId }`
  predicate, so these rows are correctly included exactly as they already
  are in the list endpoint — no special-casing needed or added.
- **Two agents in the same branch**: each has their own `User.notificationsReadAt`;
  one marking read never changes the other's cursor or count — verified
  explicitly by a dedicated test (see Test Plan).
- **Two contacts under the same customer**: same isolation guarantee,
  keyed by `Contact.id` rather than `Customer.id` — also explicitly tested.
- **Unread-count/mark-as-read fetch fails in the nav badge**: the badge is
  simply omitted; the nav link itself is never affected (same resilience
  convention as every other independent, non-blocking query in this
  codebase).

## Test Plan

**Backend unit** (extend `apps/api/src/modules/notifications/notifications.service.spec.ts`,
mirroring `notification-preferences.service.spec.ts`'s mock-Prisma shape):
- `getUnreadCount` — scopes by `ticket.branchId`/`customerId: null`; omits
  the `loggedAt` filter when the caller's cursor is `null`; includes it
  (`gt: cursor`) when set.
- `markRead` — updates the caller's own `User.notificationsReadAt` to
  "now"; never touches another user's row.
- `getUnreadCountForCustomer`/`markReadForContact` — same two behaviors,
  scoped by `customerId`/`Contact.id`.

**Backend e2e** (new `apps/api/test/notification-read-state.e2e-spec.ts`
for the agent side, extending `portal-notifications.e2e-spec.ts` for the
portal side — both mirror `notifications-read.e2e-spec.ts`'s real-`AppModule`/
real-Postgres bootstrap and its `eventEmitter.emit(...)` + poll-for-row
technique):
- rejects an unauthenticated request (401) on both new routes, both
  surfaces;
- rejects an Agent-role user lacking `notification:read` (403) on both new
  agent routes;
- unread count is `> 0` after a real `sla.at_risk`/`ticket.escalated`
  event is emitted and persisted, then `0` immediately after calling
  mark-as-read;
- **critical isolation test**: two distinct agents in the same branch (or
  two distinct portal-enabled `Contact`s under the same `Customer`) each
  see the same nonzero unread count before either marks read; one calls
  mark-as-read; re-fetching confirms *that* caller's count is now `0` while
  the *other* caller's count is unchanged.
- a cursor of `null` (a brand-new seeded user/contact that has never called
  mark-as-read) reports every existing matching row as unread.

**Frontend component** (extend
`notification-history-view.spec.tsx` on both `apps/web` and `apps/portal`):
- mounting the view (with a successful notifications query) triggers the
  mark-as-read mutation exactly once;
- a 403'd notifications query never triggers mark-as-read.
- `workspace-nav.spec.tsx` / `portal-header.spec.tsx` (extend or create,
  matching whichever already exists): renders the badge when
  `unreadCount > 0`, renders nothing when `0` or the query is
  loading/erroring.

## Migration / Rollback

- **One migration**: `identity.users` and `customers.contacts` each gain a
  nullable `notifications_read_at` column. No existing table altered
  destructively, no backfill needed (a `null` cursor is a valid,
  meaningful "never read" state, not a data-migration gap).
- **Rollback**: drop the migration; revert the four new controller routes,
  the four new/extended service methods, the frontend API-client/hook
  additions, and the two nav-badge additions. Fully additive — no existing
  route, method, model, or event is modified.

## Verification Steps

1. `pnpm --filter @crm/api typecheck && pnpm --filter @crm/api lint`
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or, if the sandbox blocks `migrate
   reset --force`: `pnpm prisma:seed` from `apps/api`, then
   `npx vitest run test/notification-read-state.e2e-spec.ts
   test/portal-notifications.e2e-spec.ts --no-file-parallelism`, per
   `CLAUDE.md` §5's documented fallback). This story adds no new listener
   on any shared domain event, so the full non-isolated e2e sweep is run
   once as a general regression check per §5's baseline instruction, not
   because this story's own risk profile requires it.
4. `pnpm --filter @crm/web test`
5. `pnpm --filter @crm/portal test`
6. `pnpm typecheck && pnpm lint && pnpm build`
7. `git status --short`

## Done Criteria

- [ ] `User.notificationsReadAt`/`Contact.notificationsReadAt` exist,
      migration applied.
- [ ] `GET /notifications/unread-count` and `PATCH /notifications/read-state`
      exist, `notification:read`-gated, branch-scoped, self-cursor only.
- [ ] `GET /portal/notifications/unread-count` and
      `PATCH /portal/notifications/read-state` exist, `@PortalRoute()`-gated,
      customer-scoped, self-cursor only.
- [ ] Both history views (`apps/web`, `apps/portal`) mark read on
      successful mount; both nav entries show an unread-count badge.
- [ ] One recipient's mark-as-read never changes another recipient's
      unread count (explicitly tested on both surfaces).
- [ ] `NotificationLog` gains no new column; no per-notification
      read/unread row is ever created.
- [ ] Every item in `## Test Plan` is added and passing.
- [ ] Every command in `## Verification Steps` passes (or is substituted
      per its own documented fallback).
- [ ] Every pre-existing test suite remains green, unweakened.
