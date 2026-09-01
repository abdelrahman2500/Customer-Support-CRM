# channels-web-form-intake — plan overview

Entry point for the **channels-web-form-intake** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 87  | [87-story-channels-web-form-intake.md](./87-story-channels-web-form-intake.md) | Communication/Channels — Public Web-Form Ticket Intake | — | `ticketing` Story 07/08 (`TicketsService`, `ticket.created`), `customer-management` Story 06 (`CustomersService`, `Contact`), `realtime-socketio-foundation`/`customer-portal-live-chat` Story 77 (`ChannelsModule`, `ChannelMessagesService`, `ChannelType.WEB_FORM`, `TicketChannelService`) |

## Dependency notes

- Selected via a fresh, whole-repository Recon after Story 86 (`CLAUDE.md`
  §2/§8). `docs/architecture/03-domain-boundaries.md`'s "Communication /
  Channels" row is the least-implemented domain in the repository today:
  `ChannelsModule` (`channel-messages.service.ts`) has exactly one real
  producer, `TicketChannelService`, and it only ever writes `LIVE_CHAT`
  (Story 77) and `AI_CHAT` (Story 85) messages. `ChannelType.WEB_FORM` has
  existed in the Prisma enum since Story 77's own migration
  (`20260831082539_add_channel_messages`) and is explicitly called out,
  three times over, in that story's and Story 85's plan docs as having
  "no producer" — a real, long-standing, previously-flagged gap, not an
  invented one.
- **Why this is unblocked and `EMAIL`/`WHATSAPP`/`SMS` are not**:
  `docs/architecture/06-communication-and-realtime.md` splits the four
  channels along a "buy vs. build" line — `docs/architecture/12-risks-
  tradeoffs-and-scope.md`'s trade-off table records "Buy provider delivery,
  build orchestration/adapters" for channel *delivery*, with no concrete
  email/WhatsApp/SMS provider named anywhere in the repository (confirmed
  again during this Recon, unchanged since Story 86's own note on this
  point). Web forms are the one channel the docs describe as self-hosted
  from the start ("Web forms use a public, rate-limited API endpoint") —
  no third-party account, webhook signature scheme, or provider adapter is
  needed to build it. It is therefore the only one of the four channel
  producers eligible for selection under `CLAUDE.md` §2's external-
  provider-decision exclusion.
- **Dependency correctness**: builds only on infrastructure already fully
  in place and untouched by this story — `TicketsService.
  createTicketForContact` (Story 53), `ChannelMessagesService.
  createInboundFromContact` (Story 77, already generic over `ChannelType`),
  `TicketChannelService`'s existing "compose `TicketsService` +
  `ChannelMessagesService`, no authorization of its own for a ticket the
  caller just created" pattern (Story 85's `recordAiChatTranscript`), and
  the global `@Public()`/`ThrottlerGuard` mechanisms already used by
  `POST /auth/login`. Nothing new is invented structurally.
- **Architectural coherence**: stays inside `Ticketing`'s existing
  "customer-scoped, no `TenantContext`" carve-out (`tickets.service.ts`'s
  own Story 53 section header) — this story adds one more caller of that
  carve-out, an *anonymous* one, exactly the way Story 53 added the
  *portal-authenticated* one. `CustomersService` gains one new method
  mirroring `TicketsService.requireDepartmentInScope`'s own established
  precedent of a cross-domain service reading another domain's Prisma
  model directly for a scope-existence check (`prisma.department...`/
  `prisma.branch...` from `TicketsService`/`IdentityService` respectively)
  — not a new pattern, an existing one reused.
- **Product value**: closes the Communication/Channels domain's single
  largest gap relative to the Full CRM Vision's own "multi-channel
  communication" pillar (`CLAUDE.md`'s Mission) — today the *only* way any
  ticket enters the system is either an authenticated agent
  (`POST /tickets`) or an authenticated portal customer
  (`POST /portal/tickets`). There is no channel at all for a prospect or
  existing customer who is not yet a portal user to reach the company —
  the exact gap a public "Contact us" web form exists to close.
- **Non-goals carried forward deliberately**: no frontend widget/page in
  `apps/web` or `apps/portal` (the architecture describes this as "a
  public, rate-limited **API** endpoint", not a portal screen — an
  external site embeds its own form against it, mirroring how Stories 36/37
  shipped a backend endpoint with no frontend consumer yet, added later in
  a separate story); no CAPTCHA/spam-scoring beyond rate limiting; no
  public branch-picker/listing endpoint (the caller supplies `branchId`
  directly — see the story's own Design decisions); no `EMAIL`/`WHATSAPP`/
  `SMS` producer (still blocked, unchanged); no attachment support on the
  initial submission.
