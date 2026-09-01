# Story 86 — Customer Portal: Live Notification Delivery

## Prerequisites

- `realtime-socketio-foundation` Story 20 / `realtime-agent-presence`
  Story 71 / `customer-portal-live-chat` Story 77 —
  `apps/api/src/realtime/realtime.gateway.ts` (`RealtimeGateway`,
  `RealtimeClaims`, `authorizeRoom`, per-socket `join`).
- `in-app-notification-delivery` Story 22 / `_(unplanned)_
  agent-workspace-notification-display` Story 24 —
  `BranchNotificationRealtimeListener` (the "relay an already-existing
  domain event into a room" pattern), `useBranchNotifications`,
  `BranchNotifications`, `NotificationToaster`, `notifications-store.ts`
  (the client-side shape this story mirrors for `apps/portal`).
- `customer-portal-live-chat` Story 77/78 — `TicketRealtimeListener`,
  `CHANNEL_MESSAGE_CREATED_EVENT`, `ChannelMessageSummary`,
  `usePortalTicketRealtime` (the portal's existing, single realtime
  subscription, scoped to one ticket page only).

All are complete and already merged to `main`.

## Story Goal

A signed-in portal customer is notified live, from anywhere in the portal
(not only while viewing one specific ticket's page), when:

1. an agent replies on one of their tickets (`channel.message.created`,
   agent-authored only), or
2. one of their tickets is updated (`ticket.updated` — status change,
   reassignment, resolution, etc.).

This is delivered exactly the way the Agent Workspace's own first
notification iteration was (Story 20/22/24): a new realtime room joined
once per session, a small relay listener, and a transient toast stack —
no persistence, no history, no preferences, no template, no non-in-app
channel.

## Non-Goals

- No `NotificationLog` row written for either event on behalf of a
  Contact — `NotificationLog.ticketId` already has a required FK to
  `Ticket`, and neither event needs a durable audit trail to satisfy this
  story's goal. A future story may add portal notification history the
  same way Story 36 added it for agents; this story does not.
- No notification-preferences toggle, no notification-template
  substitution — mirrors the fact that Stories 58/61/63 were separate,
  later increments on top of the agent-side foundation, not part of its
  first iteration.
- No email/SMS/WhatsApp/push delivery of any kind — Communication/
  Channels' provider-backed channels remain blocked on an unresolved
  external-provider decision (unchanged; see this feature's `00-overview.md`).
- No change to `ticket:{id}`'s existing behavior, `usePortalTicketRealtime`,
  or `TicketRealtimeListener` — this story adds a second, independent room
  and listener; it does not modify the first.
- No new room/event for `sla.at_risk`/`sla.breached`/`ticket.escalated` —
  those are internal SLA/escalation signals with no customer-facing
  equivalent (mirrors `RealtimeGateway.emitToAgentsInRoom`'s existing
  agent-only routing for the identical events inside `ticket:{id}`); a
  customer's only two new events are the two named above.
- No badge/unread-count/notification-center UI — a transient toast stack
  only, exactly like `NotificationToaster`'s own first iteration.

## Design decisions

1. **New room: `customer:{customerId}:notifications`, not
   `contact:{contactId}:...`.** Portal ticket visibility is already
   Customer-scoped (every `PortalTicketsService` method resolves
   `customerId` from the authenticated Contact and scopes through it —
   `TicketsService.listTicketsForCustomer`/`getTicketForCustomer` never
   take a Contact id). Any Contact belonging to the same `Customer` can
   already see the same tickets and messages, so the room must be
   Customer-scoped too, or a second Contact from the same company would
   silently miss notifications for tickets they can otherwise fully see.

2. **`RealtimeGateway.authorizeRoom` gains one more case**, mirroring the
   existing `ticket:(.+)$` customer branch exactly: a new
   `/^customer:(.+):notifications$/` pattern, authorized only for
   `audience === "customer"` whose own `Contact.customerId` (resolved via
   the identical `this.prisma.contact.findUnique({ where: { id:
   claims.userId } })` lookup the ticket-room case already performs)
   matches the room's id. Explicitly agent-only-rejected the other way:
   an `audience: "agent"` socket is refused this room outright (mirrors
   `branch:{id}:notifications`/`agent:{id}:presence` being customer-
   rejected in the reverse direction) — agents already have their own,
   separate `branch:{id}:notifications` mechanism and have no reason to
   read a customer's room.

3. **New listener, not an extension of `TicketRealtimeListener` or
   `BranchNotificationRealtimeListener`.** `TicketRealtimeListener`
   relays into `ticket:{id}` (a room scoped to one ticket, joined only
   while viewing it); `BranchNotificationRealtimeListener` relays
   agent-only events into a branch-wide room. Neither's existing
   responsibility matches "relay into a *customer*-wide room" — a third,
   independent listener (`CustomerNotificationRealtimeListener`) is added
   in `apps/api/src/realtime/`, structurally identical to
   `BranchNotificationRealtimeListener` (one `@OnEvent` handler per event,
   a shared `relay()` helper, try/catch, `Logger.error`, never rethrows),
   registered as a third provider in `RealtimeModule` alongside the other
   two. This keeps each listener's responsibility narrow and testable in
   isolation, exactly like the existing two already are from each other.

4. **`ticket.updated` relays unconditionally** (every field change,
   mirroring `BranchNotificationRealtimeListener.onSlaAtRisk`/
   `onSlaBreached`'s own "no filtering, always relay" precedent for an
   event that is synchronous in its own payload). `TicketUpdatedEvent`
   already carries `ticket.customerId` directly — no extra Prisma lookup
   needed, relay is synchronous.

5. **`channel.message.created` relays only when `message.senderUserId !==
   null`** — the one and only signal in `ChannelMessageSummary` that a
   message was authored by `createOutboundFromUser` (a real agent reply).
   This excludes: the customer's own just-sent message (no self-notify),
   and Story 85's `createSystemMessage` transcript-replay rows (both
   `senderContactId`/`senderUserId` `null` — replaying old AI-chat history
   onto a brand-new ticket must not fire a live "new reply" toast for
   messages that were already read in the chat widget). Unlike
   `ticket.updated`, this event's payload carries no `customerId` — the
   listener performs one `prisma.ticket.findUnique({ where: { id:
   event.ticketId }, select: { customerId: true } })` lookup first,
   mirroring `BranchNotificationRealtimeListener.onTicketEscalated`'s own
   identical "resolve the missing scoping field via one Prisma call"
   pattern exactly (including its two failure branches: ticket not found
   → no relay, Prisma throws → catch-and-log, never rethrow).

6. **Client-side shape mirrors `apps/web`'s Story 24 file-for-file**,
   adapted to `apps/portal`'s existing conventions (`getSocketBaseUrl`/
   `getAccessToken` from `@/lib/api`, `next-intl` `useTranslations`):
   - `apps/portal/src/lib/notifications-store.ts` — a Zustand store,
     structurally identical to `apps/web`'s (same auto-dismiss timer,
     same `MAX_VISIBLE` cap, same `add`/`dismiss` shape), typed for this
     portal's own two event/payload shapes instead.
   - `apps/portal/src/hooks/use-portal-notifications.ts` — mirrors
     `useBranchNotifications` exactly: joins
     `customer:{customerId}:notifications` on `connect` (safe across
     reconnects, same as the existing hook), listens for `"ticket.updated"`
     and `"channel.message.created"` (hardcoded literal event-name
     strings, exactly like `useBranchNotifications` already hardcodes
     `"sla.at_risk"` etc. rather than importing them from `apps/api`),
     forwards via an `onEvent` ref-held callback.
   - `apps/portal/src/components/portal/portal-notifications.tsx` — the
     mount-once component (`useCustomerId` prop), mirrors
     `BranchNotifications` (minus the preferences/template wiring — Non-
     Goals item 2).
   - `apps/portal/src/components/portal/notification-toaster.tsx` — the
     presentational stack, mirrors `apps/web`'s `NotificationToaster`
     (fixed corner position using logical `top-*`/`end-*` per
     `docs/architecture/10-i18n-and-rtl.md`, `role="status"`/
     `aria-live="polite"`, dismiss button, a "View ticket" button
     navigating to `/${locale}/tickets/${ticketId}` — the same route
     `ticket-list-view.tsx` already navigates to).

7. **Mount point: `(customer)/layout.tsx`, alongside `PortalHeader`** —
   exactly where `(agent)/layout.tsx` mounts `BranchNotifications`
   alongside `WorkspaceNav`. `contact.customerId` (already returned by
   `GET /portal/auth/me`/`fetchCurrentContact()`, already used to render
   `PortalHeader`) is passed straight through — no new API call needed to
   learn the room id.

8. **Message copy**: `ticket.updated` renders `t("ticketUpdated", {
   subject, status })` ("Your ticket "{subject}" was updated — status:
   {status}."), reusing the same "render the raw status enum value
   verbatim" convention `ticket-detail-view.tsx`/`ticket-list-view.tsx`
   already use (no new status-label i18n map introduced).
   `channel.message.created` renders `t("newReply")` ("You have a new
   reply on your ticket.") plus a truncated (120-char) body preview line —
   the payload carries no ticket subject (Design decision 5), so the
   message is deliberately generic; the "View ticket" button is what
   carries the user to full context, exactly like `NotificationToaster`'s
   own SLA-event messages are already terse for the same reason.

## Context — Read These Files First

- `apps/api/src/realtime/realtime.gateway.ts` — `authorizeRoom`'s
  existing `ticket:(.+)$` customer branch (the exact lookup this story's
  new branch mirrors) and its agent-only branches (the exact "reject the
  other audience" precedent).
- `apps/api/src/realtime/branch-notification-realtime.listener.ts` and its
  spec — the listener shape and test shape this story's new listener
  mirrors line-for-line.
- `apps/api/src/realtime/ticket-realtime.listener.ts` — confirms
  `ticket.updated`/`channel.message.created` are already customer-visible
  today (no new exposure argument).
- `apps/api/src/modules/tickets/tickets.events.ts` — `TicketUpdatedEvent`
  shape (`{ ticket: TicketSummary, actorUserId }`, `TicketSummary.customerId`).
- `apps/api/src/modules/channels/channel-messages.events.ts` /
  `channel-messages.service.ts` — `ChannelMessageCreatedEvent` shape,
  `createOutboundFromUser`/`createInboundFromContact`/`createSystemMessage`
  (which one sets `senderUserId`).
- `apps/api/src/realtime/realtime.module.ts` — provider registration.
- `apps/web/src/hooks/use-branch-notifications.ts`,
  `apps/web/src/components/notifications/branch-notifications.tsx`,
  `apps/web/src/components/notifications/notification-toaster.tsx`,
  `apps/web/src/lib/notifications-store.ts` — the exact four-file shape
  this story's portal-side files mirror.
- `apps/portal/src/lib/api.ts` (`getSocketBaseUrl`, `getAccessToken`),
  `apps/portal/src/hooks/use-portal-ticket-realtime.ts` (portal's existing
  Socket.IO connection shape), `apps/portal/src/components/portal/
  portal-header.tsx` and `apps/portal/src/app/[locale]/(customer)/
  layout.tsx` (mount point), `packages/shared/src/auth.ts`
  (`AuthenticatedContact.customerId`).

## Backend Tasks

1. **`apps/api/src/realtime/realtime.gateway.ts`** — in `authorizeRoom`,
   add (after the `ticket:(.+)$` branch, before the agent-only guard):
   ```ts
   const customerNotificationsMatch = /^customer:(.+):notifications$/.exec(room);
   if (customerNotificationsMatch) {
     if (claims.audience !== "customer") {
       return false;
     }
     const contact = await this.prisma.contact.findUnique({
       where: { id: claims.userId },
       select: { customerId: true },
     });
     return contact !== null && contact.customerId === customerNotificationsMatch[1];
   }
   ```
   Update the class-level doc comment with a short Story 86 paragraph
   noting the new room and its audience restriction.

2. **New file `apps/api/src/realtime/customer-notification-realtime.listener.ts`**:
   ```ts
   import { Injectable, Logger } from "@nestjs/common";
   import { OnEvent } from "@nestjs/event-emitter";
   import { RealtimeGateway } from "./realtime.gateway";
   import { PrismaService } from "../prisma/prisma.service";
   import { TICKET_UPDATED_EVENT } from "../modules/tickets/tickets.events";
   import type { TicketUpdatedEvent } from "../modules/tickets/tickets.events";
   import { CHANNEL_MESSAGE_CREATED_EVENT } from "../modules/channels/channel-messages.events";
   import type { ChannelMessageCreatedEvent } from "../modules/channels/channel-messages.events";

   @Injectable()
   export class CustomerNotificationRealtimeListener {
     private readonly logger = new Logger(CustomerNotificationRealtimeListener.name);

     constructor(
       private readonly gateway: RealtimeGateway,
       private readonly prisma: PrismaService,
     ) {}

     @OnEvent(TICKET_UPDATED_EVENT)
     onTicketUpdated(event: TicketUpdatedEvent): void {
       this.relay(TICKET_UPDATED_EVENT, event.ticket.customerId, event);
     }

     @OnEvent(CHANNEL_MESSAGE_CREATED_EVENT)
     async onChannelMessageCreated(event: ChannelMessageCreatedEvent): Promise<void> {
       if (!event.message.senderUserId) {
         return;
       }
       try {
         const ticket = await this.prisma.ticket.findUnique({
           where: { id: event.ticketId },
           select: { customerId: true },
         });
         if (!ticket) {
           return;
         }
         this.relay(CHANNEL_MESSAGE_CREATED_EVENT, ticket.customerId, event);
       } catch (error) {
         this.logger.error(
           `Failed to resolve customer for ticket ${event.ticketId}`,
           error as Error,
         );
       }
     }

     private relay(eventName: string, customerId: string, payload: unknown): void {
       try {
         this.gateway.server.to(`customer:${customerId}:notifications`).emit(eventName, payload);
       } catch (error) {
         this.logger.error(`Failed to relay ${eventName} for customer ${customerId}`, error as Error);
       }
     }
   }
   ```

3. **`apps/api/src/realtime/realtime.module.ts`** — register
   `CustomerNotificationRealtimeListener` as a fourth provider; update the
   module doc comment with a one-paragraph Story 86 note mirroring the
   existing Story 71/80 notes' style.

## Frontend Tasks — `apps/portal`

1. **`apps/portal/src/lib/notifications-store.ts`** (new) — Zustand store
   mirroring `apps/web/src/lib/notifications-store.ts`'s shape:
   `PortalNotificationEventType = "ticket.updated" | "channel.message.created"`,
   `TicketUpdatedNotificationPayload { ticket: { id, subject, status },
   actorUserId }`, `ChannelMessageNotificationPayload { ticketId, message:
   { id, body, senderUserId } }`, `PortalNotification`, `add`/`dismiss`,
   same `AUTO_DISMISS_MS`/`MAX_VISIBLE` constants.

2. **`apps/portal/src/hooks/use-portal-notifications.ts`** (new) — mirrors
   `use-branch-notifications.ts`: `usePortalNotifications(customerId:
   string | null, onEvent: (eventType, payload) => void)`, joins
   `customer:${customerId}:notifications`, listens for the two event
   names, ref-held `onEvent`, connect/cleanup on `customerId` change.

3. **`apps/portal/src/components/portal/notification-toaster.tsx`** (new)
   — presentational stack mirroring `apps/web`'s `NotificationToaster`
   (no template map — Non-Goals item 2): renders `t("regionLabel")` region,
   per-notification dismiss button, event-specific message (Design
   decision 8), and a "View ticket" button linking to
   `/${locale}/tickets/${ticketId}`.

4. **`apps/portal/src/components/portal/portal-notifications.tsx`** (new)
   — mount component: `PortalNotifications({ customerId }: { customerId:
   string })`, wires `usePortalNotifications` to the store's `add` action,
   renders `<NotificationToaster />`.

5. **`apps/portal/src/app/[locale]/(customer)/layout.tsx`** — mount
   `<PortalNotifications customerId={contact.customerId} />` alongside
   `<PortalHeader contact={contact} />`.

6. **`apps/portal/messages/{en,ar}.json`** — new top-level `notifications`
   key: `regionLabel` ("Notifications" / "الإشعارات"), `dismiss`
   ("Dismiss" / "إغلاق"), `viewTicket` ("View ticket" / "عرض التذكرة"),
   `ticketUpdated` ("Your ticket \"{subject}\" was updated — status:
   {status}." / `"تم تحديث تذكرتك \"{subject}\" — الحالة: {status}."`),
   `newReply` ("You have a new reply on your ticket." / "لديك رد جديد على
   تذكرتك."), `generic` ("New notification" / "إشعار جديد").

## Edge Cases & Failure Modes

- **A customer with two open portal sessions (two Contacts of the same
  Customer, or two tabs)**: both receive every relayed event — intentional
  (Design decision 1), matches existing ticket-visibility scoping.
- **A ticket reassigned to a different `customerId`** (not a real
  operation anywhere in this codebase today — `Ticket.customerId` is never
  reassigned by any existing endpoint): out of scope; `ticket.updated`
  simply relays into the room named by the event's own (unchanged)
  `customerId`.
- **`channel.message.created` for a ticket that no longer exists by the
  time the listener's lookup runs** (impossible in practice — messages are
  always created against an existing ticket in the same request — but
  handled defensively exactly like `BranchNotificationRealtimeListener.
  onTicketEscalated`): no relay, no throw.
- **A socket joins `customer:{customerId}:notifications` for a
  `customerId` that is not its own**: rejected by `authorizeRoom`,
  identical in shape to every other room's existing rejection path.
- **An agent-audience socket attempts to join this room**: rejected
  outright (Design decision 2) — no agent-facing consumer exists or is
  added by this story.

## Test Plan

1. **`apps/api/src/realtime/realtime.gateway.spec.ts`** — new
   `customer:{id}:notifications` cases mirroring the existing
   `ticket:(.+)$` customer-branch tests: a customer whose own
   `Contact.customerId` matches is authorized; a mismatched customerId is
   rejected; an agent-audience socket is rejected outright; a nonexistent
   contact id is rejected.
2. **`apps/api/src/realtime/customer-notification-realtime.listener.spec.ts`**
   (new) — mirrors `branch-notification-realtime.listener.spec.ts`'s exact
   shape: `onTicketUpdated` relays synchronously using
   `event.ticket.customerId`; `onChannelMessageCreated` with a
   `senderUserId` resolves the ticket's `customerId` via Prisma and
   relays; with no `senderUserId` it never queries Prisma or relays; a
   ticket-not-found resolves without relaying; a Prisma rejection is
   caught and logged, never thrown; a `server.to(...).emit(...)` throw is
   caught and logged for both handlers.
3. **`apps/api/src/realtime/realtime.module.ts`** — no dedicated spec file
   exists for this module today (confirmed by Recon); none added,
   consistent with precedent.
4. **`apps/portal/src/lib/notifications-store.spec.ts`** (new) — mirrors
   `apps/web/src/lib/notifications-store.spec.ts`: `add` prepends, caps at
   `MAX_VISIBLE`, auto-dismisses after the timer; `dismiss` removes by id.
5. **`apps/portal/src/hooks/use-portal-notifications.spec.ts`** (new) —
   mirrors `use-branch-notifications.spec.ts`: joins the right room on
   connect; forwards both event types verbatim; does nothing when
   `customerId` is `null`; cleans up listeners/socket on unmount.
6. **`apps/portal/src/components/portal/notification-toaster.spec.tsx`**
   (new) — renders nothing with an empty store; renders the right message
   for each event type; dismiss button removes the entry; "View ticket"
   navigates to the right route.
7. **`apps/portal/src/components/portal/portal-notifications.spec.tsx`**
   (new) — wires the hook's events into the store's `add`.

## Migration / Rollback

- No Prisma schema change — this story is entirely realtime-transport and
  frontend. Nothing to migrate or roll back at the database layer.
- **Rollback**: revert the `authorizeRoom` addition, remove
  `CustomerNotificationRealtimeListener` from `RealtimeModule`, and revert
  the `apps/portal` files. Fully additive — no existing route, event, or
  room is modified, so a partial rollback (frontend reverted, backend not)
  is harmless: an unused room with no listener relaying into it, or a
  frontend that never joins a room the backend still authorizes, are both
  inert.
- **Half-applied state**: safe — old portal frontend code never joins
  `customer:{id}:notifications`; old backend code never emits into it if
  the listener isn't registered.

## Verification Steps

1. `pnpm --filter @crm/api typecheck && pnpm --filter @crm/api lint`
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or, if the sandbox's
   `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` gate blocks
   `test:e2e:prepare`'s `migrate reset --force`, re-seed via `pnpm
   prisma:seed` and rely on the unit-level gateway/listener specs above —
   this story adds no new e2e-spec file since it introduces no new HTTP
   route; the existing `realtime.gateway.spec.ts` suite is unit-level and
   unaffected by the e2e-database gate).
4. `pnpm --filter @crm/portal typecheck && pnpm --filter @crm/portal lint && pnpm --filter @crm/portal test`
5. `pnpm typecheck && pnpm lint && pnpm build`
6. `git status --short`

## Done Criteria

- [ ] `customer:{customerId}:notifications` exists, is authorized only for
      the matching Customer's own Contacts, and rejects agent-audience
      sockets outright.
- [ ] `CustomerNotificationRealtimeListener` relays `ticket.updated`
      (unconditionally) and `channel.message.created` (agent-authored
      only) into that room, registered in `RealtimeModule`.
- [ ] `apps/portal` joins the room once per session (mounted in
      `(customer)/layout.tsx`) and renders a transient, dismissible toast
      for each relayed event with a working "View ticket" link.
- [ ] No change to `ticket:{id}`'s existing behavior, `usePortalTicketRealtime`,
      or `TicketRealtimeListener`.
- [ ] No `NotificationLog` write, no preferences, no template, no non-in-app
      delivery introduced.
- [ ] Every item in `## Test Plan` is added and passing.
- [ ] Every command in `## Verification Steps` passes (or is substituted
      per its own documented note).
- [ ] Every pre-existing test suite remains green, unweakened.
