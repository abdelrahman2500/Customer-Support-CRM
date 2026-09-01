# Story 88 — Customer Portal: Notification History

## Prerequisites

- `notifications-read-endpoint` Story 36 —
  `apps/api/src/modules/notifications/notifications.service.ts`/
  `notifications.controller.ts` (`NotificationsService.listNotifications`,
  `NotificationSummary`, the `NotificationLog`-read pattern this story
  extends).
- `sla-at-risk-notification-reaction`/`ticket-escalation-notification-reaction`
  Story 18/19 —
  `apps/api/src/modules/notifications/ticket-escalated-notification.listener.ts`
  (the "record-only, `dedupeKey`-based idempotency, catch-and-log, never
  rethrow" listener pattern this story's new listener mirrors exactly).
- `customer-portal-notification-delivery` Story 86 —
  `apps/api/src/realtime/customer-notification-realtime.listener.ts`
  (`customer:{customerId}:notifications` recipient-resolution boundary —
  `TICKET_UPDATED_EVENT` always relayed, `CHANNEL_MESSAGE_CREATED_EVENT`
  relayed only when `message.senderUserId` is set — this story persists
  the identical two events under the identical filter, so the read history
  matches what the live toast already showed).
- `customer-portal-authentication-foundation` Story 52/53 —
  `apps/api/src/modules/portal/portal.service.ts`
  (`PortalService.getAuthenticatedContact`), `apps/api/src/modules/portal/
  portal-tickets.controller.ts` (the `@PortalRoute()` + `request.user as
  JwtAccessTokenClaims` + `contact.sub` pattern this story's new
  controller reuses verbatim).

All are complete and already merged to `main`.

## Story Goal

A Customer Portal customer who missed a live in-app notification (Story
86's toast — only visible while the portal tab is open) can retrieve their
own notification history from the backend, mirroring what
`GET /notifications` already gives an agent (Story 36):

1. The same two events Story 86 already relays live —
   `ticket.updated` (unconditional) and `channel.message.created` (only
   when it is a genuine agent reply, i.e. `message.senderUserId` is set)
   — are now also durably persisted to `NotificationLog`, scoped to the
   ticket's `customerId`.
2. A new `GET /portal/notifications` endpoint returns that customer's own
   notification rows, newest first — read-only, no pagination, no
   filtering, matching `GET /notifications`'s own scope exactly.
3. The existing agent-facing `GET /notifications` endpoint's result set is
   unchanged — it must not start returning the new portal-scoped rows.

## Non-Goals

- **No per-event preference toggle for the portal.** Mirrors
  `NotificationPreference` (Story 58) being a later, separate story on the
  agent side, added only after Story 36's read endpoint existed. Story 88
  is that same first increment for the portal.
- **No notification templates.** `NotificationTemplate` (Story 61) is a
  branch-admin resource for outbound copy, unrelated to a customer reading
  their own history.
- **No "mark as read"/unread-count state.** `NotificationLog` has no such
  column anywhere in this codebase today (confirmed by Recon); adding one
  would be a new, separate concern affecting the agent-facing model too —
  out of scope here.
- **No `apps/portal` frontend surface consuming the new endpoint.** Mirrors
  Story 36's own precedent exactly: `GET /notifications` shipped backend-
  only, and its agent-facing frontend consumer (Story 39, "Notification
  History") arrived in a separate, later, explicitly-scoped story. Story
  86 already gave the portal a *live* toast UI; a *history* UI is a
  reasonable, but separate, next increment.
- **No `EMAIL`/`WHATSAPP`/`SMS` delivery.** Unchanged — still blocked on an
  unresolved external-provider decision (`docs/architecture/12-risks-
  tradeoffs-and-scope.md`).
- **No change to what Story 86 already relays live.** This story only adds
  a durable, read-later copy of the identical two events under the
  identical filter — it does not add, remove, or alter any realtime event.

## Design decisions

1. **`NotificationLog` gains one new nullable column, `customerId`.**
   `NotificationLog.ticketId` is non-nullable and every `Ticket` already
   has a `customerId`, but the *existing* agent-facing query
   (`NotificationsService.listNotifications`) scopes through the `ticket`
   relation to the caller's `branchId`, not through any customer
   identity — introducing a first-class `customerId` column (rather than
   resolving it through the ticket relation on every read, the way
   `listNotifications` already resolves `branchId`) is what lets the
   portal's read query filter directly and cheaply, and lets the two
   audiences' rows be told apart with a plain `where` clause instead of
   inventing a `targetType` convention for it (`targetType` already means
   something else — the SLA-timer target kind — reusing it here would
   overload an existing column with a second, unrelated meaning). One
   migration, purely additive:
   ```prisma
   model NotificationLog {
     // ...existing columns unchanged...
     customerId String?   @map("customer_id")
     customer   Customer? @relation(fields: [customerId], references: [id], onDelete: Cascade)
     // ...
   }
   ```
   `Customer` (in `customers.service.ts`'s schema) gains the matching
   back-relation array field. Every existing writer
   (`SlaAtRiskNotificationListener`, `TicketEscalatedNotificationListener`)
   is untouched and continues to leave `customerId` `null` — this column
   is additive, not a breaking change to any existing row or query.

2. **New listener, `PortalNotificationLogListener`, lives in
   `apps/api/src/modules/notifications/`** (not `apps/api/src/realtime/`,
   where `CustomerNotificationRealtimeListener` lives) — mirrors this
   codebase's own established split exactly: a `notifications`-domain
   listener *persists* `NotificationLog` rows (Story 18/19's
   `SlaAtRiskNotificationListener`/`TicketEscalatedNotificationListener`),
   while a `realtime`-domain listener *relays* the same source events live
   over Socket.IO (Story 20/22's `BranchNotificationRealtimeListener`,
   Story 86's `CustomerNotificationRealtimeListener`). The two listener
   families already coexist independently for the exact same source
   events on the agent side (`ticket.escalated` has both a
   `TicketEscalatedNotificationListener`, persisting, and a
   `BranchNotificationRealtimeListener`, relaying) — this story adds the
   missing persisting half for the portal's two events, which today have
   only the relaying half.
   - `onTicketUpdated(event: TicketUpdatedEvent)`: always records,
     `dedupeKey: \`${event.ticket.id}:${event.ticket.updatedAt.toISOString()}\``
     — unique per actual row change (`updatedAt` changes on every
     `TicketsService.updateTicket` call), so a caught `P2002` unique-
     violation (the same `(eventType, dedupeKey)` constraint Story 19's
     listener already relies on) means "already logged this exact
     update," not a bug.
   - `onChannelMessageCreated(event: ChannelMessageCreatedEvent)`: records
     only when `event.message.senderUserId` is set — identical filter to
     `CustomerNotificationRealtimeListener.onChannelMessageCreated`, for
     the identical reason (no self-notify on the customer's own message;
     no duplicate-of-something-already-read for Story 85's AI-chat
     transcript replay). `dedupeKey: event.message.id` (globally unique —
     one `ChannelMessage` row can never fire this event twice).
   - Both handlers resolve `customerId` the same way
     `CustomerNotificationRealtimeListener` already does: `TicketUpdatedEvent.
     ticket.customerId` is already on the payload (no lookup); the channel-
     message handler does one `prisma.ticket.findUnique` for
     `customerId` (ticket not found → skip, mirrors the realtime listener's
     own "ticket not found → no relay" branch).
   - Catch-and-log throughout, never rethrows — identical to every other
     `NotificationLog`-writing listener in this codebase; a failed write
     must never fail the ticket update or message send it is reacting to.

3. **`NotificationsService.listNotifications()` (agent-facing, unchanged
   route) adds `customerId: null` to its existing `where` clause.** This
   is the one required change to existing, shipped behavior — without it,
   the new portal-scoped rows this story starts writing would silently
   start appearing in every agent's `GET /notifications` result the moment
   this story ships, which is not part of what that endpoint is scoped to
   (its own doc comment: "the same set `BranchNotificationRealtimeListener`
   relays" — `ticket.updated`/agent-reply rows are not in that set). A new
   regression test asserts this explicitly: seed one agent-scoped
   (`ticket.escalated`) and one portal-scoped (`ticket.updated`,
   `customerId` set) `NotificationLog` row for the same ticket/branch and
   assert `listNotifications()` returns only the first.

4. **New `NotificationsService.listNotificationsForCustomer(customerId:
   string): Promise<NotificationSummary[]>`.** Reuses the exact same
   `NotificationSummary` interface `listNotifications()` already returns
   (`id`, `eventType`, `ticketId`, `branchId`, `targetType`, `targetAt`,
   `loggedAt`) — `branchId`/`targetType`/`targetAt` are simply always
   `null` for these rows, exactly as consistent as `ticket.escalated`
   rows already are for the agent-facing endpoint (Story 36's own doc
   comment already documents that nullable-and-sometimes-`null` shape).
   No new DTO/interface needed. Query: `where: { customerId },
   orderBy: { loggedAt: "desc" }` — no `ticket` relation join needed
   (unlike the agent method, which resolves `branchId` through it), since
   `customerId` is now a first-class, indexed column.

5. **`NotificationsModule` exports `NotificationsService`.** Currently
   exports nothing (Recon-confirmed) — this is the module's first
   controller-external consumer. `PortalModule` imports `NotificationsModule`
   the same way it already imports `TicketsModule`/`KnowledgeBaseModule`/
   `AiModule`/`AdminModule` (all four for the identical reason: a Portal
   controller injects an already-exported service from another domain
   module directly, per that module's own doc comment's established
   convention). No import cycle: `NotificationsModule` imports nothing
   from `PortalModule`.

6. **New `PortalNotificationsController`
   (`apps/api/src/modules/portal/portal-notifications.controller.ts`,
   route `portal/notifications`)** — `@PortalRoute()`, injects
   `PortalService` and `NotificationsService` directly (no intermediate
   `PortalNotificationsService`, mirrors `PortalKnowledgeBaseController`/
   `PortalChatController`'s own "no intermediate service" precedent — the
   only composition needed is one `getAuthenticatedContact` call, not
   worth a dedicated service class). One route:
   ```ts
   @PortalRoute()
   @Get()
   async list(@Req() request: Request): Promise<NotificationSummary[]> {
     const contact = request.user as JwtAccessTokenClaims;
     const { customerId } = await this.portalService.getAuthenticatedContact(contact.sub);
     return this.notificationsService.listNotificationsForCustomer(customerId);
   }
   ```

## Context — Read These Files First

- `apps/api/src/modules/notifications/notifications.service.ts` — the
  existing `NotificationSummary` interface and `listNotifications`'s own
  doc comment (its exact "why `ticket.branchId`, not
  `NotificationLog.branchId`" reasoning this story's new method
  deliberately does *not* need, since `customerId` is a first-class
  column here from the start).
- `apps/api/src/modules/notifications/ticket-escalated-notification.listener.ts`
  — the exact `dedupeKey`/`P2002`-catch/never-rethrow pattern this story's
  new listener mirrors.
- `apps/api/src/realtime/customer-notification-realtime.listener.ts` — the
  identical event pair and identical `senderUserId` filter this story's
  new listener persists a durable copy of.
- `apps/api/src/modules/notifications/notifications.module.ts` — current
  `providers`/no `exports` array.
- `apps/api/src/modules/portal/portal.module.ts` and
  `portal-knowledge-base.controller.ts` — the "import the module, inject
  the already-exported service directly, no intermediate service" pattern
  this story's `PortalNotificationsController` reuses.
- `apps/api/src/modules/portal/portal-tickets.controller.ts` — the
  `@PortalRoute()` + `request.user as JwtAccessTokenClaims` + `contact.sub`
  pattern.
- `apps/api/src/modules/portal/portal.service.ts` —
  `getAuthenticatedContact`'s existing signature/behavior (unchanged).
- `apps/api/prisma/schema.prisma` — `NotificationLog`, `Customer` models;
  `Ticket.updatedAt`'s `@updatedAt` behavior (confirms it changes on every
  `TicketsService.updateTicket` call, the basis for design decision 2's
  `dedupeKey`).

## Backend Tasks

1. **Migration** — add `customerId String? @map("customer_id")` +
   `customer Customer? @relation(fields: [customerId], references: [id],
   onDelete: Cascade)` to `NotificationLog`; add the matching
   `notificationLogs NotificationLog[]` back-relation to `Customer`. Run
   `pnpm --filter @crm/api prisma:migrate` (or `prisma migrate dev
   --name add_notification_log_customer_id` from `apps/api`) to generate
   the migration against the running dev Postgres, then
   `pnpm --filter @crm/api prisma:generate`.
2. **`apps/api/src/modules/notifications/portal-notification-log.listener.ts`**
   (new) — `PortalNotificationLogListener`, per design decision 2.
3. **`apps/api/src/modules/notifications/notifications.service.ts`** —
   add `customerId: null` to `listNotifications()`'s `where` clause; add
   `listNotificationsForCustomer(customerId: string)`.
4. **`apps/api/src/modules/notifications/notifications.module.ts`** —
   register `PortalNotificationLogListener` as a provider; add
   `exports: [NotificationsService]`.
5. **`apps/api/src/modules/portal/portal-notifications.controller.ts`**
   (new) — per design decision 6.
6. **`apps/api/src/modules/portal/portal.module.ts`** — import
   `NotificationsModule`; register `PortalNotificationsController`.

## Test Plan

1. **`apps/api/src/modules/notifications/portal-notification-log.listener.spec.ts`**
   (new) — `onTicketUpdated` writes a `NotificationLog` row with
   `customerId`/`dedupeKey` set correctly and swallows a `P2002` retry
   without throwing; `onChannelMessageCreated` writes only when
   `senderUserId` is set, resolves `customerId` via the mocked Prisma
   ticket lookup, skips silently when the ticket is not found, and
   catches/logs a Prisma error without rethrowing.
2. **`apps/api/src/modules/notifications/notifications.service.spec.ts`**
   — extend: `listNotifications()` now asserts `customerId: null` is
   present in the Prisma `where` call (regression coverage for design
   decision 3); new `listNotificationsForCustomer` describe block asserts
   the `where`/`orderBy` shape and the mapped `NotificationSummary[]`
   result.
3. **New `apps/api/test/portal-notifications.e2e-spec.ts`** — bootstraps
   the real `AppModule` (mirrors `portal-tickets.e2e-spec.ts`'s
   `beforeAll` shape: portal login via seeded Contact credentials);
   creates a ticket for that customer, updates it as an agent (triggers
   `ticket.updated`), sends an agent reply via
   `POST /tickets/:id/messages` (triggers `channel.message.created` with
   `senderUserId` set) — then asserts `GET /portal/notifications` returns
   both rows, newest first, and that the agent-facing
   `GET /notifications` for the same branch does **not** include either
   new row (cross-checks design decision 3 end-to-end, not just via the
   service-level mock). Also asserts an unauthenticated request is
   rejected (401) and an `agent`-audience token is rejected (401, via
   `@PortalRoute()`'s existing `AudienceGuard`, unchanged).

## Migration / Rollback

- **One additive Prisma migration** — nullable `customer_id` column +
  FK on `notification_logs`. No data backfill needed (existing rows stay
  `null`, unchanged meaning). `onDelete: Cascade` matches
  `NotificationLog.ticket`'s own existing `onDelete: Cascade` — a deleted
  Customer's history rows are cleaned up rather than left orphaned.
- **Rollback**: revert `notifications.module.ts`'s new provider/export,
  `portal.module.ts`'s new import/controller, delete the two new files
  (`portal-notification-log.listener.ts`,
  `portal-notifications.controller.ts`), revert
  `notifications.service.ts`'s two changes, then revert the migration
  (`prisma migrate resolve` per Prisma's standard down-migration process,
  or a follow-up additive migration dropping the column). Fully additive
  otherwise — no existing route, method, or event is modified.

## Verification Steps

1. `pnpm --filter @crm/api typecheck && pnpm --filter @crm/api lint`
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or, if the sandbox's
   `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` gate blocks
   `test:e2e:prepare`'s `migrate reset --force`: `pnpm prisma:seed` from
   `apps/api`, then `npx vitest run test/portal-notifications.e2e-spec.ts
   --no-file-parallelism` to verify this story's own e2e coverage in
   isolation, per `CLAUDE.md` §5's documented fallback).
4. `pnpm typecheck && pnpm lint && pnpm build`
5. `git status --short`

## Done Criteria

- [ ] `NotificationLog` has a nullable `customerId` column via one
      additive migration; `Customer` has the matching back-relation.
- [ ] `PortalNotificationLogListener` persists a `NotificationLog` row for
      every `ticket.updated` and for every `channel.message.created` whose
      `senderUserId` is set, scoped to the ticket's `customerId`,
      idempotent via `dedupeKey`.
- [ ] `GET /portal/notifications` (`@PortalRoute()`) returns the
      authenticated customer's own notification rows, newest first.
- [ ] `GET /notifications` (agent-facing, unchanged route) never returns
      the new portal-scoped rows — verified by both a unit and an e2e
      regression assertion.
- [ ] Every item in `## Test Plan` is added and passing.
- [ ] Every command in `## Verification Steps` passes (or is substituted
      per its own documented fallback).
- [ ] Every pre-existing test suite remains green, unweakened.
