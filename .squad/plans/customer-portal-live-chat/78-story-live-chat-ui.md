# Story 78 — Live Chat UI (Agent Workspace + Customer Portal)

## Goal

Complete Story 77's Live Chat feature by building the frontend on both
`apps/web` (agent) and `apps/portal` (customer): a chat card on each app's
existing ticket detail page, reading/sending through Story 77's own REST
endpoints, kept live by Story 77's own `channel.message.created` realtime
event. Story 77's own plan scoped it to `apps/api` only ("Files expected to
change" lists zero frontend files) — this story is that deliberate, planned
continuation, not a fix to something incomplete.

## Non-goals

- Any `apps/api` change — Story 77 is the fixed backend contract; if this
  story's frontend work reveals a genuine contract mismatch, that would be
  a separate, explicitly-flagged finding, not something fixed silently here.
- Message attachments, anonymous/public chat, typing indicators, read
  receipts, message editing/deletion/reactions/search, AI-generated
  replies, email/SMS/WhatsApp integrations or any other `ChannelType`
  producer, replay-history-on-join — all explicitly out of scope per
  Story 77's own non-goals, unchanged by this story.
- A shared cross-app UI package for the two chat cards. Every other
  ticket-scoped DTO in this codebase (`TicketNoteSummary`,
  `PortalTicketSummary`, etc.) is independently re-declared per app, not
  centralized in `@crm/shared` — `ChannelMessageSummary` and the two
  `TicketChatCard` components follow that same existing convention.

## Design decisions

1. **`useTicketRealtime`/`usePortalTicketRealtime` gain
   `channel.message.created` handling, not a second socket connection.**
   `apps/web`'s `useTicketRealtime` already opens one socket per ticket
   detail page and joins `ticket:{id}`; a fourth `socket.on(...)` case is
   added there. `apps/portal` had no realtime subscription at all — a new
   `usePortalTicketRealtime` mirrors `useTicketRealtime`'s connect/join/
   cleanup shape exactly, subscribing only to `channel.message.created`
   (the other three ticket-room events are agent-only or agent-side ticket
   state this Portal surface has never shown).
2. **Realtime chat messages merge into the cache; every other event still
   invalidates.** `useTicketRealtime`'s existing convention for
   `ticket.updated`/`ticket.escalated`/`ticket.note-added` is "invalidate,
   never trust the socket payload." Chat is different on purpose: a live
   conversation refetching its entire history on every incoming message
   would be poor UX for a fast-flowing exchange, and Story 77's own
   broadcast semantics (`server.to(room).emit(...)`, sender included) mean
   the sender's own sent message always arrives back over the socket. Both
   apps' send-mutations and realtime handlers call the same
   `mergeChannelMessage` (one per app, mirroring the existing
   per-app-re-declaration convention): append unless the message's `id` is
   already present, then keep the list chronological. This is what makes a
   message appear once whether it arrives via the POST response, the
   socket echo, or both.
3. **`useCurrentUserQuery` (new, `apps/web` only).** Distinguishing "my own
   message" from a colleague's requires knowing the signed-in agent's own
   id — unlike a Portal contact (exactly one per ticket, ownership-scoped),
   several different agents can send `OUTBOUND` messages on the same
   ticket. A small `GET /auth/me` query hook, client-side counterpart of
   `fetchCurrentUser` (`@/lib/auth-server`, server-only). `apps/portal`
   doesn't need this: every `INBOUND` message is always "this contact's
   own," every `OUTBOUND` one is always "an agent's," generically labeled
   (a Portal contact has no access to the agent user list).
4. **Each `TicketChatCard` is its own component/file**, mirroring
   `AttachmentsCard`'s own precedent (Story 66/67) rather than inlining
   into `TicketDetailView`: it owns real interactive state (the composer)
   and its own realtime-merge wiring. `apps/web`'s follows the shared
   `@/components/ui` primitives (`Alert`/`Button`/`Skeleton`) `AttachmentsCard`
   uses; `apps/portal` has no such library, so its version mirrors that
   app's own plain-Tailwind `TicketDetailView`/`CsatForm` style exactly.

## Files expected to change

- `apps/web/src/lib/ticket-messages-api.ts` (new): `ChannelMessageSummary`,
  `CreateChannelMessageInput`, `getTicketMessages`, `createTicketMessage`.
- `apps/web/src/hooks/use-ticket-messages.ts` (new): `mergeChannelMessage`
  (+ spec), `ticketMessagesQueryKey`, `useTicketMessagesQuery`,
  `useCreateTicketMessageMutation`.
- `apps/web/src/hooks/use-tickets.ts`: new `useCurrentUserQuery`.
- `apps/web/src/hooks/use-ticket-realtime.ts` (+ spec): new
  `channel.message.created` handling.
- `apps/web/src/components/tickets/ticket-chat-card.tsx` (new, + spec):
  `TicketChatCard`/`ChatComposer`.
- `apps/web/src/components/tickets/ticket-detail-view.tsx` (+ spec):
  renders `TicketChatCard`.
- `apps/web/messages/{en,ar}.json`: new `tickets.detail.chat*` keys.
- `apps/portal/src/lib/tickets-api.ts`: new `ChannelMessageSummary`,
  `CreateChannelMessageInput`, `getMyTicketMessages`, `sendMyTicketMessage`.
- `apps/portal/src/lib/api.ts`: new `getSocketBaseUrl` (this app's first
  realtime consumer needed it; mirrors `apps/web`'s exactly).
- `apps/portal/src/hooks/use-portal-tickets.ts` (+ spec): new
  `mergeChannelMessage`, `myTicketMessagesQueryKey`,
  `useMyTicketMessagesQuery`, `useSendMyTicketMessageMutation`.
- `apps/portal/src/hooks/use-portal-ticket-realtime.ts` (new, + spec):
  this app's first realtime subscription.
- `apps/portal/src/components/tickets/ticket-chat-card.tsx` (new, + spec).
- `apps/portal/src/components/tickets/ticket-detail-view.tsx` (+ spec):
  calls `usePortalTicketRealtime`, renders `TicketChatCard`.
- `apps/portal/messages/{en,ar}.json`: new `tickets.detail.chat*` keys.
- `apps/portal/package.json` + `pnpm-lock.yaml`: new `socket.io-client`
  dependency (already used by `apps/web`, same pinned version).

## Acceptance criteria

- Agent Workspace's ticket detail page shows a Live Chat card: loads
  history via `GET /tickets/:id/messages`, sends via
  `POST /tickets/:id/messages`, reflects new messages via the existing
  `channel.message.created` event without a full refetch.
- Customer Portal's ticket detail page shows the corresponding chat UI
  against `POST/GET /portal/tickets/:id/messages`, kept live by this app's
  first realtime subscription joining the same `ticket:{id}` room.
- A message the sender's own socket echoes back never renders twice.
- An event for a different ticket than the one currently open is ignored.
- Sender identity is distinguished correctly on both apps (see intake's
  own acceptance criteria for the exact per-app labeling rules).
- Every pre-existing test suite remains green, unweakened.

## Verification plan

- Unit/component tests: `mergeChannelMessage` (pure-function specs, both
  apps, mirroring `sla.spec.ts`'s own precedent of testing a pure helper
  directly — this codebase's `useQuery`/`useMutation` hooks have never had
  dedicated specs, components mock them instead); `TicketChatCard` (both
  apps: loading/error/empty/populated, sender-label distinction, send
  success/pending/failure, Enter-to-send/Shift+Enter); `useTicketRealtime`/
  `usePortalTicketRealtime` (`channel.message.created` merge, cross-ticket
  filtering, unmount cleanup) — all mirroring their nearest existing
  precedent's exact mocking patterns (`attachments-card.spec.tsx`,
  `use-ticket-realtime.spec.ts`'s own prior cases).
- No `apps/api`/`apps/worker` change — no new e2e coverage needed there;
  Story 77's own e2e suite already proves the contract this story's
  frontend consumes.
- Full workspace: `pnpm --filter @crm/web test`, `pnpm --filter @crm/portal
  test`, `pnpm --filter @crm/web typecheck`, `pnpm --filter @crm/portal
  typecheck`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`
  (root, confirms `apps/api`/`apps/worker` genuinely unaffected).
